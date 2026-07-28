# frozen_string_literal: true

class CaptionsController < ApplicationController
  layout 'caption'

  before_action :redirect_signed_out_to_homepage, only: :update

  def show
    # Rendered normally (not redirected) even when signed out, so link-preview
    # crawlers (which are never logged in) still see this page's og:image
    # instead of being bounced to the homepage before they can read it.
    return render :signed_out unless user_signed_in?

    @only_mine = truthy_param?(:only_mine)
    @media_attachment = random_uncaptioned_media_attachment
    @leaderboard = caption_leaderboard
  end

  def update
    @only_mine = truthy_param?(:only_mine)
    media_attachment = eligible_media_attachments.find_by(id: params[:media_attachment_id])
    if media_attachment&.update(description: params[:caption])
      # MediaAttachment isn't part of the search index itself, so the parent
      # status needs to be reindexed for the new alt text to become searchable
      # (see Status::SearchConcern#searchable_text). A plain `touch` does NOT
      # do this: Chewy.use_after_commit_callbacks is false, so Chewy hooks
      # into `after_save`, and `touch` bypasses `after_save` entirely (Rails
      # only runs `after_touch` callbacks for it). Call the Chewy hook
      # directly instead.
      if (status = media_attachment.status)
        status.touch
        status.update_chewy_indices
      end
      CaptionSubmission.create!(account: current_account, media_attachment: media_attachment)
    end

    redirect_to captions_root_path(only_mine: @only_mine)
  end

  private

  def caption_leaderboard
    CaptionSubmission.joins(:account).group('accounts.username').order(Arel.sql('count_all DESC')).count
  end

  def redirect_signed_out_to_homepage
    redirect_to root_url(host: Rails.configuration.x.web_domain) unless user_signed_in?
  end

  # Scoped to blank descriptions only, so a photo captioned by someone else
  # between page load and submit silently can't be overwritten here.
  def eligible_media_attachments
    scope = MediaAttachment.local.image.attached.where(description: [nil, ''])
    scope = scope.where(account_id: current_account.id) if @only_mine
    scope
  end

  def random_uncaptioned_media_attachment
    eligible_media_attachments.order(Arel.sql('RANDOM()')).first
  end
end
