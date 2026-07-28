# frozen_string_literal: true

class ProcessMentionsService < BaseService
  include Payloadable

  # Tin Can Phone Club: named group mentions. "all" is dynamic (everyone
  # currently following the poster); everything else is a fixed username
  # list. Add/edit groups here -- no migration needed, just a code change.
  GROUPS = {
    'all' => :everyone,
    'sickysisters' => %w(Chloe Leo),
    'fossils' => %w(Baba grampyfr),
    'kids' => %w(owen Leo Chloe warwick_willow),
  }.freeze

  # Scan status for mentions and fetch remote mentioned users,
  # and create local mention pointers
  # @param [Status] status
  def call(status)
    @status = status

    return unless @status.local?

    @previous_mentions = @status.mentions.includes(:account).to_a
    @current_mentions  = []

    Status.transaction do
      scan_text!
      assign_mentions!
    end
  end

  private

  def scan_text!
    @status.text = @status.text.gsub(Account::MENTION_RE) do |match|
      username, domain = Regexp.last_match(1).split('@')

      domain = if TagManager.instance.local_domain?(domain)
                 nil
               else
                 TagManager.instance.normalize_domain(domain)
               end

      # Tin Can Phone Club: named group mentions (see GROUPS above) --
      # notifies a whole group instead of looking up a single account.
      # Guarded by an existence check so a real account with the same
      # name would never be shadowed by this. Leave the matched text
      # untouched -- the "mention-all" styling is applied later, at
      # render time, by TextFormatter. Embedding the <span> directly into
      # the stored status text doesn't work, because that text gets
      # HTML-escaped right back into visible "<span>...</span>" text the
      # next time it's rendered.
      group_key = username.downcase
      if domain.nil? && GROUPS.key?(group_key) && !Account.exists?(username: username, domain: nil)
        if GROUPS[group_key] == :everyone
          broadcast_mentions!
        else
          mention_group!(GROUPS[group_key])
        end
        next match
      end

      mentioned_account = Account.find_remote(username, domain)

      # Unapproved and unconfirmed accounts should not be mentionable
      next match if mentioned_account&.local? && !(mentioned_account.user_confirmed? && mentioned_account.user_approved?)

      # If the account cannot be found or isn't the right protocol,
      # first try to resolve it
      if mention_undeliverable?(mentioned_account)
        begin
          mentioned_account = ResolveAccountService.new.call(Regexp.last_match(1))
        rescue Webfinger::Error, *Mastodon::HTTP_CONNECTION_ERRORS, Mastodon::UnexpectedResponseError
          mentioned_account = nil
        end
      end

      # If after resolving it still isn't found or isn't the right
      # protocol, then give up
      next match if mention_undeliverable?(mentioned_account) || mentioned_account&.unavailable?

      mention   = @previous_mentions.find { |x| x.account_id == mentioned_account.id }
      mention ||= @current_mentions.find  { |x| x.account_id == mentioned_account.id }
      mention ||= @status.mentions.new(account: mentioned_account)

      mention.silent = false

      @current_mentions << mention

      "@#{mentioned_account.acct}"
    end

    @status.save! if @status.persisted?
  end

  def assign_mentions!
    # Make sure we never mention blocked accounts
    unless @current_mentions.empty?
      mentioned_domains = @current_mentions.filter_map { |m| m.account.domain }.uniq
      blocked_domains   = Set.new(mentioned_domains.empty? ? [] : AccountDomainBlock.where(account_id: @status.account_id, domain: mentioned_domains).pluck(:domain))
      mentioned_account_ids = @current_mentions.map(&:account_id)
      blocked_account_ids = Set.new(@status.account.block_relationships.where(target_account_id: mentioned_account_ids).pluck(:target_account_id))

      dropped_mentions, @current_mentions = @current_mentions.partition { |mention| blocked_account_ids.include?(mention.account_id) || blocked_domains.include?(mention.account.domain) }
      dropped_mentions.each(&:destroy)
    end

    return unless @status.persisted?

    @current_mentions.each do |mention|
      mention.save if mention.new_record? || mention.silent_changed?
    end

    # If previous mentions are no longer contained in the text, convert them
    # to silent mentions, since withdrawing access from someone who already
    # received a notification might be more confusing
    removed_mentions = @previous_mentions - @current_mentions

    Mention.where(id: removed_mentions.map(&:id), silent: false).update_all(silent: true) unless removed_mentions.empty?
  end

  def broadcast_mentions!
    @status.account.followers.each do |mentioned_account|
      next unless mentioned_account.local? && mentioned_account.user_confirmed? && mentioned_account.user_approved?

      mention   = @previous_mentions.find { |x| x.account_id == mentioned_account.id }
      mention ||= @current_mentions.find  { |x| x.account_id == mentioned_account.id }
      mention ||= @status.mentions.new(account: mentioned_account)

      mention.silent = false

      @current_mentions << mention
    end
  end

  def mention_group!(usernames)
    Account.where(username: usernames, domain: nil).find_each do |mentioned_account|
      next unless mentioned_account.user_confirmed? && mentioned_account.user_approved?

      mention   = @previous_mentions.find { |x| x.account_id == mentioned_account.id }
      mention ||= @current_mentions.find  { |x| x.account_id == mentioned_account.id }
      mention ||= @status.mentions.new(account: mentioned_account)

      mention.silent = false

      @current_mentions << mention
    end
  end

  def mention_undeliverable?(mentioned_account)
    mentioned_account.nil? || (!mentioned_account.local? && !mentioned_account.activitypub?)
  end
end