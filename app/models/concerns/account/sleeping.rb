# frozen_string_literal: true

module Account::Sleeping
  extend ActiveSupport::Concern

  included do
    scope :sleeping, -> { where.not(sleeping_at: nil) }
    scope :without_sleeping, -> { where(sleeping_at: nil) }
  end

  def sleeping?
    sleeping_at.present?
  end

  def sleep!(date: Time.now.utc)
    update!(sleeping_at: date)
  end

  def wake!
    update!(sleeping_at: nil)
  end
end
