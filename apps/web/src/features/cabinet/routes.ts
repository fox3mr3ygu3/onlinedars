/** Cabinet URL builders and React Query keys (one place so links and invalidation stay in sync). */
export const cabinetRoutes = {
  dashboard: '/cabinet',
  courses: '/cabinet/courses',
  course: (courseId: string) => `/cabinet/courses/${courseId}`,
  lesson: (courseId: string, lessonId: string) =>
    `/cabinet/courses/${courseId}/lessons/${lessonId}`,
  practice: (courseId: string, lessonId: string, practiceId: string) =>
    `/cabinet/courses/${courseId}/lessons/${lessonId}/practice/${practiceId}`,
  exam: (courseId: string) => `/cabinet/courses/${courseId}/exam`,
  results: '/cabinet/results',
  certificates: '/cabinet/certificates',
  payments: '/cabinet/payments',
  notifications: '/cabinet/notifications',
  profile: '/cabinet/profile',
} as const;

export const qk = {
  dashboard: ['me', 'dashboard'] as const,
  courses: (page: number) => ['me', 'courses', page] as const,
  course: (courseId: string) => ['me', 'course', courseId] as const,
  lesson: (lessonId: string) => ['me', 'lesson', lessonId] as const,
  practice: (practiceId: string) => ['me', 'practice', practiceId] as const,
  exam: (courseId: string) => ['me', 'exam', courseId] as const,
  results: (page: number) => ['me', 'results', page] as const,
  certificates: ['me', 'certificates'] as const,
  orders: (page: number) => ['me', 'orders', page] as const,
  notifications: (unreadOnly: boolean) => ['me', 'notifications', unreadOnly] as const,
  me: ['me', 'user'] as const,
};
