'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { meApi } from '@/lib/api/me';
import { cn } from '@/lib/utils';
import { qk } from './routes';
import { EmptyState, formatDate, PageHeader, QueryBoundary, useErrorMessage } from './ui';

export function NotificationsList() {
  const t = useTranslations('notifications');
  const errorMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const query = useQuery({
    queryKey: qk.notifications(unreadOnly),
    queryFn: () => meApi.notifications({ unreadOnly, pageSize: 50 }),
  });

  const markRead = useMutation({
    mutationFn: meApi.markNotificationRead,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['me', 'notifications'] }),
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <div>
      <PageHeader title={t('title')}>
        <div className="flex gap-1 rounded-lg border p-1" role="group">
          <Button
            size="sm"
            variant={!unreadOnly ? 'secondary' : 'ghost'}
            aria-pressed={!unreadOnly}
            onClick={() => setUnreadOnly(false)}
          >
            {t('all')}
          </Button>
          <Button
            size="sm"
            variant={unreadOnly ? 'secondary' : 'ghost'}
            aria-pressed={unreadOnly}
            onClick={() => setUnreadOnly(true)}
          >
            {t('onlyUnread')}
          </Button>
        </div>
      </PageHeader>
      <QueryBoundary query={query}>
        {(list) => (
          <>
            {list.unreadCount > 0 ? (
              <p className="text-muted-foreground mb-3 text-sm">
                {t('unread', { count: list.unreadCount })}
              </p>
            ) : null}
            {list.items.length === 0 ? (
              <EmptyState>{t('empty')}</EmptyState>
            ) : (
              <ul className="space-y-2">
                {list.items.map((n) => {
                  const unread = !n.readAt;
                  return (
                    <li
                      key={n.id}
                      data-testid={`notification-${n.id}`}
                      data-unread={unread}
                      className={cn(
                        'bg-card flex gap-3 rounded-xl border p-4',
                        unread && 'border-primary/40 bg-primary/5',
                      )}
                    >
                      <Bell
                        className={cn(
                          'mt-0.5 size-5 shrink-0',
                          unread ? 'text-primary' : 'text-muted-foreground',
                        )}
                        aria-hidden="true"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{n.title}</p>
                        <p className="text-sm">{n.body}</p>
                        <p className="text-muted-foreground mt-1 text-xs">
                          {formatDate(n.createdAt, true)}
                        </p>
                      </div>
                      {unread ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => markRead.mutate(n.id)}
                          disabled={markRead.isPending && markRead.variables === n.id}
                        >
                          <Check aria-hidden="true" />
                          <span className="sr-only sm:not-sr-only">{t('markRead')}</span>
                        </Button>
                      ) : (
                        <span className="text-muted-foreground text-xs">{t('read')}</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </QueryBoundary>
    </div>
  );
}
