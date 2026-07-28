# frozen_string_literal: true

class StatusesSearchService < BaseService
  include SearchStoplight

  MARK_RE = /<mark>(.*?)<\/mark>/.freeze

  attr_reader :highlights

  def call(query, account = nil, options = {})
    MastodonOTELTracer.in_span('StatusesSearchService#call') do |span|
      @query      = query&.strip
      @account    = account
      @options    = options
      @limit      = options[:limit].to_i
      @offset     = options[:offset].to_i
      @highlights = {}
      convert_deprecated_options!

      span.add_attributes(
        'search.offset' => @offset,
        'search.limit' => @limit,
        'search.backend' => Chewy.enabled? ? 'elasticsearch' : 'database'
      )

      status_search_results.tap do |results|
        span.set_attribute('search.results.count', results.size)
      end
    end
  end

  private

  def status_search_results
    chained             = parsed_query.request.collapse(field: :id).order(id: { order: :desc }).limit(@limit).offset(@offset)
    results             = elastic_stoplight_wrapper.run { chained.objects.compact }
    @highlights         = chained.wrappers.to_h { |wrapper| [wrapper.id.to_i, highlight_terms_for(wrapper)] }
    account_ids         = results.map(&:account_id)
    account_domains     = results.map(&:account_domain)

    @account.preload_relations!(account_ids, account_domains)

    results.reject { |status| StatusFilter.new(status, @account).filtered? || (@options[:local_only] && !status.account.local?) }
  rescue Stoplight::Error::RedLight, Faraday::ConnectionFailed, Parslet::ParseFailed, Errno::ENETUNREACH, OpenSSL::SSL::SSLError, Elastic::Transport::Transport::Error
    @highlights = {}
    []
  end

  def highlight_terms_for(wrapper)
    Array(wrapper.text_highlights).flat_map { |fragment| fragment.scan(MARK_RE).flatten }.uniq
  end

  def parsed_query
    SearchQueryTransformer.new.apply(SearchQueryParser.new.parse(@query), current_account: @account)
  end

  def convert_deprecated_options!
    syntax_options = []

    if @options[:account_id]
      username = Account.select(:username, :domain).find(@options[:account_id]).acct
      syntax_options << "from:@#{username}"
    end

    if @options[:min_id]
      timestamp = Mastodon::Snowflake.to_time(@options[:min_id].to_i)
      syntax_options << "after:\"#{timestamp.iso8601}\""
    end

    if @options[:max_id]
      timestamp = Mastodon::Snowflake.to_time(@options[:max_id].to_i)
      syntax_options << "before:\"#{timestamp.iso8601}\""
    end

    @query = "#{@query} #{syntax_options.join(' ')}".strip if syntax_options.any?
  end
end