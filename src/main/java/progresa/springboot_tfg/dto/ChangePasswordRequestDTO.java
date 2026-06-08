package progresa.springboot_tfg.dto;

public class ChangePasswordRequestDTO {

    private String currentPassword;
    private String newPassword;

    public ChangePasswordRequestDTO() {
    }

    public String getCurrentPassword() {
        return currentPassword;
    }

    public void setCurrentPassword(String currentPassword) {
        this.currentPassword = currentPassword;
    }

    public String getNewPassword() {
        return newPassword;
    }

    public void setNewPassword(String newPassword) {
        this.newPassword = newPassword;
    }
}
