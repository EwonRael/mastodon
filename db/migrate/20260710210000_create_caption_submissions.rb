# frozen_string_literal: true

class CreateCaptionSubmissions < ActiveRecord::Migration[8.1]
  def change
    create_table :caption_submissions do |t|
      t.references :account, null: false, foreign_key: { on_delete: :cascade }
      t.references :media_attachment, foreign_key: { on_delete: :nullify }

      t.timestamps
    end
  end
end
