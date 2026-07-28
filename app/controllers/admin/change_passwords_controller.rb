# frozen_string_literal: true

module Admin
  class ChangePasswordsController < BaseController
    before_action :set_account
    before_action :require_local_account!

    def show
      authorize @user, :change_password?
    end

    def update
      authorize @user, :change_password?

      if @user.update(password: resource_params.fetch(:password))
        @user.session_activations.destroy_all
        @user.revoke_access!

        log_action :change_password, @user

        redirect_to admin_account_path(@account.id), notice: I18n.t('admin.accounts.change_password.changed_msg')
      else
        render :show, status: :unprocessable_entity
      end
    end

    private

    def set_account
      @account = Account.find(params[:account_id])
      @user = @account.user
    end

    def require_local_account!
      redirect_to admin_account_path(@account.id) unless @account.local? && @account.user.present?
    end

    def resource_params
      params
        .expect(user: [:password])
    end
  end
end
