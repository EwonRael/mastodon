# frozen_string_literal: true

class Api::V2::SearchController < Api::BaseController
  include AsyncRefreshesConcern
  include Authorization

  RESULTS_LIMIT = 20

  before_action -> { authorize_if_got_token! :read, :'read:search' }
  before_action :validate_search_params!

  with_options unless: :user_signed_in? do
    before_action :query_pagination_error, if: :pagination_requested?
    before_action :remote_resolve_error, if: :remote_resolve_requested?
  end
  before_action :require_valid_pagination_options!
  before_action :handle_fasp_requests

  def index
    @search = Search.new(search_results)
    render json: @search, serializer: REST::SearchSerializer, highlights: @search_service.statuses_highlights
  rescue Mastodon::SyntaxError
    unprocessable_content
  rescue ActiveRecord::RecordNotFound
    not_found
  end

  private

  def validate_search_params!
    params.require(:q)
  end

  def query_pagination_error
    render json: { error: 'Search queries pagination is not supported without authentication' }, status: 401
  end

  def remote_resolve_error
    render json: { error: 'Search queries that resolve remote resources are not supported without authentication' }, status: 401
  end

  def handle_fasp_requests
    # Tin Can Phone Club: never query external FASP providers, keep search fully local
    nil
  end

  def remote_resolve_requested?
    truthy_param?(:resolve)
  end

  def pagination_requested?
    params[:offset].present?
  end

  def search_results
    @search_service = SearchService.new
    @search_service.call(
      params[:q],
      current_account,
      limit_param(RESULTS_LIMIT),
      combined_search_params
    )
  end

  def combined_search_params
    search_params.merge(
      resolve: false,
      exclude_unreviewed: truthy_param?(:exclude_unreviewed),
      following: truthy_param?(:following),
      query_fasp: false,
      local_only: true
    )
  end

  def search_params
    params.permit(:type, :offset, :min_id, :max_id, :account_id, :following)
  end
end