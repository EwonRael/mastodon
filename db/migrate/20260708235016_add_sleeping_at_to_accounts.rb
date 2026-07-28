# frozen_string_literal: true

class AddSleepingAtToAccounts < ActiveRecord::Migration[8.1]
  def change
    add_column :accounts, :sleeping_at, :datetime, precision: nil
  end
end
