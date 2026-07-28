# frozen_string_literal: true

class CaptionSubmission < ApplicationRecord
  belongs_to :account
  belongs_to :media_attachment, optional: true
end
