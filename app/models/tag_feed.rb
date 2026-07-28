# frozen_string_literal: true

class TagFeed < PublicFeed
  LIMIT_PER_MODE = 4

  # @param [Tag] tag
  # @param [Account] account
  # @param [Hash] options
  # @option [Enumerable<String>] :any
  # @option [Enumerable<String>] :all
  # @option [Enumerable<String>] :none
  # @option [Boolean] :local
  # @option [Boolean] :remote
  # @option [Boolean] :only_media
  def initialize(tag, account, options = {})
    @tag = tag
    super(account, options)
  end

  # @param [Integer] limit
  # @param [Integer] max_id
  # @param [Integer] since_id
  # @param [Integer] min_id
  # @return [Array<Status>]
  def get(limit, max_id = nil, since_id = nil, min_id = nil)
    return [] if incompatible_feed_settings?

    scope = public_scope

    scope.merge!(tagged_with_any_scope)
    scope.merge!(tagged_with_all_scope)
    scope.merge!(tagged_with_none_scope)
    scope.merge!(local_only_scope) if local_only?
    scope.merge!(remote_only_scope) if remote_only?
    scope.merge!(account_filters_scope) if account?
    scope.merge!(media_only_scope) if media_only?

    scope.to_a_paginated_by_id(limit, max_id: max_id, since_id: since_id, min_id: min_id)
  end

  private

  # Tin Can Phone Club: everyone follows everyone, so once a viewer is an
  # authenticated real account there's no privacy boundary left to enforce --
  # widen the tag feed to include followers-only posts too (never DMs),
  # otherwise hashtags are invisible on every post since new posts default to
  # followers-only. Stays public-only when there's no account, which is what
  # keeps this safe: TagsController's RSS/ActivityPub feed always passes a
  # nil account, and LIMITED_FEDERATION_MODE forces authentication before any
  # request (API or RSS) can reach this with a real account attached, so
  # unauthenticated and remote requests never see anything but public posts.
  def public_scope
    return super unless account

    Status.list_eligible_visibility.joins(:account).merge(Account.without_suspended.without_silenced)
  end

  def local_feed_setting
    Setting.local_topic_feed_access
  end

  def remote_feed_setting
    Setting.remote_topic_feed_access
  end

  def tagged_with_any_scope
    Status.group(:id).tagged_with(tags_for(Array(@tag.name) | Array(options[:any])))
  end

  def tagged_with_all_scope
    Status.group(:id).tagged_with_all(tags_for(options[:all]))
  end

  def tagged_with_none_scope
    Status.group(:id).tagged_with_none(tags_for(options[:none]))
  end

  def tags_for(names)
    Tag.matching_name(Array(names).take(LIMIT_PER_MODE)).pluck(:id) if names.present?
  end
end