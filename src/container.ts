import type { Context } from 'hono'
import { createDb } from './db/client'
import { GoogleAuthMockGateway } from './gateways/GoogleAuthMockGateway'
import { MailerGateway } from './gateways/MailerGateway'
import { SessionKvGateway } from './gateways/SessionKvGateway'
import { SessionRevocationQueueGateway } from './gateways/SessionRevocationQueueGateway'
import { UserEventTimelineQuery } from './queries/UserEventTimelineQuery'
import { AdminUserRepository } from './repositories/AdminUserRepository'
import { EmailChangeRequestRepository } from './repositories/EmailChangeRequestRepository'
import { PasswordResetRepository } from './repositories/PasswordResetRepository'
import {
  SeedSignupLabelRepository,
  SeedUserLabelRepository,
} from './repositories/SeedLabelRepositories'
import { SignupVerificationRepository } from './repositories/SignupVerificationRepository'
import { UserBanRepository } from './repositories/UserBanRepository'
import { UserIdentityRepository } from './repositories/UserIdentityRepository'
import { UserProfileRepository } from './repositories/UserProfileRepository'
import { UserRepository } from './repositories/UserRepository'
import { UserStatusEventRepository } from './repositories/UserStatusEventRepository'
import { CurrentLifecycleStateResolver } from './services/CurrentLifecycleStateResolver'
import { DisableAdminService } from './services/DisableAdminService'
import { PasswordHashingService } from './services/PasswordHashingService'
import { SessionService } from './services/SessionService'
import { TokenIssuingService } from './services/TokenIssuingService'
import { UserStatusTransitionService } from './services/UserStatusTransitionService'
import {
  AdminLoginUseCase,
  BanUserUseCase,
  GetUserDetailUseCase,
  SearchUsersUseCase,
  UnbanUserUseCase,
} from './usecases/admin/AdminUseCases'
import { ListVerificationHomeUseCase } from './usecases/admin/ListVerificationHomeUseCase'
import {
  ForceAnonymizeUserPiiUseCase,
  ForcePurgeUserPiiUseCase,
} from './usecases/batch/BatchUseCases'
import { DevLoginAsAdminUseCase } from './usecases/dev/DevLoginAsAdminUseCase'
import { DevLoginAsUseCase } from './usecases/dev/DevLoginAsUseCase'
import {
  ChangePasswordUseCase,
  RequestEmailChangeUseCase,
  VerifyEmailChangeUseCase,
} from './usecases/emailChange/EmailChangeUseCases'
import { GoogleLoginUseCase } from './usecases/google/GoogleLoginUseCase'
import { LoginUseCase } from './usecases/login/LoginUseCase'
import { GetMeUseCase, UpdateProfileUseCase } from './usecases/me/GetMeUseCase'
import {
  RequestPasswordResetUseCase,
  ResetPasswordUseCase,
} from './usecases/passwordReset/PasswordResetUseCases'
import { ResendSignupVerificationUseCase } from './usecases/signup/ResendSignupVerificationUseCase'
import { SignupUseCase } from './usecases/signup/SignupUseCase'
import { VerifySignupUseCase } from './usecases/signup/VerifySignupUseCase'
import { CancelWithdrawUseCase, WithdrawUseCase } from './usecases/withdraw/WithdrawUseCases'

export type AppBindings = {
  Bindings: CloudflareBindings
  Variables: {
    userId?: string
    adminId?: string
  }
}

export function createContainer(c: Context<AppBindings>) {
  const db = createDb(c.env.DB)
  const userRepo = new UserRepository(db)
  const profileRepo = new UserProfileRepository(db)
  const identityRepo = new UserIdentityRepository(db)
  const signupRepo = new SignupVerificationRepository(db)
  const passwordResetRepo = new PasswordResetRepository(db)
  const emailChangeRepo = new EmailChangeRequestRepository(db)
  const adminRepo = new AdminUserRepository(db)
  const eventRepo = new UserStatusEventRepository(db)
  const banRepo = new UserBanRepository(db)
  const timelineQuery = new UserEventTimelineQuery(db)
  const seedUserLabelRepo = new SeedUserLabelRepository(db)
  const seedSignupLabelRepo = new SeedSignupLabelRepository(db)

  const sessionKv = new SessionKvGateway(c.env.SESSIONS_KV)
  const revocationQueue = new SessionRevocationQueueGateway(c.env.SESSION_REVOCATIONS)
  const mailer = new MailerGateway(c.env.APP_BASE_URL)
  const googleMock = new GoogleAuthMockGateway()

  const passwordHashing = new PasswordHashingService()
  const tokenIssuing = new TokenIssuingService()
  const sessionService = new SessionService(sessionKv, tokenIssuing, c.env.APP_ENV)
  const lifecycleResolver = new CurrentLifecycleStateResolver()
  const statusTransitions = new UserStatusTransitionService(userRepo, revocationQueue)
  const disableAdmin = new DisableAdminService(adminRepo, sessionService)

  return {
    db,
    userRepo,
    profileRepo,
    identityRepo,
    signupRepo,
    passwordResetRepo,
    emailChangeRepo,
    adminRepo,
    eventRepo,
    banRepo,
    timelineQuery,
    seedUserLabelRepo,
    seedSignupLabelRepo,
    sessionKv,
    revocationQueue,
    mailer,
    googleMock,
    passwordHashing,
    tokenIssuing,
    sessionService,
    lifecycleResolver,
    statusTransitions,
    disableAdmin,
    signup: new SignupUseCase(
      signupRepo,
      profileRepo,
      passwordHashing,
      tokenIssuing,
      mailer,
      seedSignupLabelRepo,
    ),
    verifySignup: new VerifySignupUseCase(db, signupRepo, profileRepo, tokenIssuing, sessionService),
    resendSignup: new ResendSignupVerificationUseCase(
      signupRepo,
      tokenIssuing,
      mailer,
      seedSignupLabelRepo,
    ),
    login: new LoginUseCase(userRepo, profileRepo, identityRepo, passwordHashing, sessionService),
    devLoginAs: new DevLoginAsUseCase(userRepo, sessionService),
    googleLogin: new GoogleLoginUseCase(
      db,
      userRepo,
      profileRepo,
      identityRepo,
      googleMock,
      sessionService,
    ),
    requestPasswordReset: new RequestPasswordResetUseCase(
      userRepo,
      profileRepo,
      identityRepo,
      passwordResetRepo,
      tokenIssuing,
      mailer,
    ),
    resetPassword: new ResetPasswordUseCase(
      db,
      userRepo,
      passwordResetRepo,
      identityRepo,
      tokenIssuing,
      passwordHashing,
      revocationQueue,
    ),
    requestEmailChange: new RequestEmailChangeUseCase(
      userRepo,
      profileRepo,
      emailChangeRepo,
      tokenIssuing,
      mailer,
    ),
    verifyEmailChange: new VerifyEmailChangeUseCase(emailChangeRepo, profileRepo, tokenIssuing),
    changePassword: new ChangePasswordUseCase(
      userRepo,
      identityRepo,
      passwordHashing,
      revocationQueue,
    ),
    getMe: new GetMeUseCase(
      userRepo,
      profileRepo,
      identityRepo,
      eventRepo,
      sessionService,
      emailChangeRepo,
      passwordResetRepo,
    ),
    updateProfile: new UpdateProfileUseCase(userRepo, profileRepo),
    withdraw: new WithdrawUseCase(statusTransitions),
    cancelWithdraw: new CancelWithdrawUseCase(userRepo, eventRepo, profileRepo, statusTransitions),
    adminLogin: new AdminLoginUseCase(adminRepo, passwordHashing, sessionService),
    devLoginAsAdmin: new DevLoginAsAdminUseCase(adminRepo, sessionService),
    searchUsers: new SearchUsersUseCase(userRepo),
    getUserDetail: new GetUserDetailUseCase(
      userRepo,
      profileRepo,
      identityRepo,
      timelineQuery,
      sessionService,
      emailChangeRepo,
      passwordResetRepo,
    ),
    banUser: new BanUserUseCase(statusTransitions),
    unbanUser: new UnbanUserUseCase(statusTransitions),
    forcePurgeUserPii: new ForcePurgeUserPiiUseCase(db, userRepo),
    forceAnonymizeUserPii: new ForceAnonymizeUserPiiUseCase(db, userRepo),
    listVerificationHome: new ListVerificationHomeUseCase(
      userRepo,
      profileRepo,
      identityRepo,
      eventRepo,
      banRepo,
      emailChangeRepo,
      passwordResetRepo,
      signupRepo,
      seedUserLabelRepo,
      seedSignupLabelRepo,
      lifecycleResolver,
    ),
  }
}

export type Container = ReturnType<typeof createContainer>
