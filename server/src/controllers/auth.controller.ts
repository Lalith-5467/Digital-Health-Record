import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service';

export const registerController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await AuthService.register(
      req.body,
      req.ip,
      req.headers['user-agent']
    );
    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const loginController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await AuthService.login({
      ...req.body,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getMeController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
      return;
    }

    const userProfile = await AuthService.getCurrentUser(req.user.id);
    res.status(200).json({
      success: true,
      data: userProfile,
    });
  } catch (error) {
    next(error);
  }
};

export const sendOtpController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email, name, role } = req.body;
    const result = await AuthService.sendEmailOtp(email, name, role);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const verifyOtpController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email, otp } = req.body;
    const result = await AuthService.verifyEmailOtp(email, otp);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const hospitalLoginController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await AuthService.loginHospital({
      ...req.body,
      ipAddress: req.ip || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
    });
    res.status(200).json({
      success: true,
      message: 'Hospital administrator login successful',
      token: result.token,
      user: result.user,
      hospital: result.hospital,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const hospitalRegisterController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await AuthService.registerHospital(req.body);
    res.status(201).json({
      success: true,
      message: 'Facility registered successfully and submitted for Super Admin review.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const hospitalStatusController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const identifier = req.query.email || req.query.id || req.params.identifier;
    if (!identifier || typeof identifier !== 'string') {
      res.status(400).json({ success: false, message: 'Identifier or email is required' });
      return;
    }
    const result = await AuthService.getHospitalStatus(identifier);
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const forgotPasswordController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await AuthService.requestPasswordReset(req.body.email, req.ip);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const verifyResetCodeController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email, resetCode, token, otp } = req.body;
    const result = await AuthService.verifyResetCode(email, resetCode || token || otp);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const resetPasswordController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email, resetCode, token, newPassword } = req.body;
    const result = await AuthService.confirmPasswordReset(
      email,
      resetCode || token,
      newPassword,
      req.ip
    );
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const changePasswordController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { currentPassword, newPassword } = req.body;
    const result = await AuthService.changePassword(
      req.user!.id,
      currentPassword,
      newPassword,
      req.ip
    );
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const getSessionsController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const sessions = await AuthService.getUserSessions(req.user!.id);
    res.status(200).json({ success: true, data: sessions });
  } catch (error) {
    next(error);
  }
};

export const logoutController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await AuthService.logout(req.user!.id, req.user?.jti, req.ip);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const revokeSessionController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await AuthService.revokeSession(req.user!.id, String(req.params.id), req.user?.jti);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const deactivateAccountController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await AuthService.deactivateAccount(req.user!.id, req.ip);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

