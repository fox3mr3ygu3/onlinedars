/** Hard business rule: every lesson has exactly 4 practices. */
export const PRACTICES_PER_LESSON = 4;
/** Hard business rule: every practice has exactly 6 questions. */
export const QUESTIONS_PER_PRACTICE = 6;
/** 4 × 6 = 24 questions per lesson. */
export const QUESTIONS_PER_LESSON = PRACTICES_PER_LESSON * QUESTIONS_PER_PRACTICE;

/** All money is stored as integer tiyin (1 UZS = 100 tiyin). */
export const CURRENCY = 'UZS';
export const TIYIN_PER_SOM = 100;

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
export const REFRESH_TOKEN_TTL_DAYS = 30;
export const REFRESH_COOKIE_NAME = 'od_refresh';

export const OTP_LENGTH = 6;
export const OTP_TTL_SECONDS = 5 * 60;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_COOLDOWN_SECONDS = 60;

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

/** Public certificate verification path on the web app. */
export const certificateVerifyPath = (certificateId: string) => `/verify/${certificateId}`;
