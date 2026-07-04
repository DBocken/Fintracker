import { useEffect, useMemo, useState } from "react";
import { Bell, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { showSuccess } from "@/utils/toast";
import { useI18n } from "@/i18n/useI18n";

type NotificationItem = {
  id: string;
  title: string;
  body: string;
  date: string; // ISO
};

const STORAGE_KEY = "notifications.read.v1";

function getStoredRead(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

function setStoredRead(ids: string[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
}

export default function NotificationsBell() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [readIds, setReadIds] = useState<string[]>([]);

  useEffect(() => {
    setReadIds(getStoredRead());
  }, []);

  useEffect(() => {
    setStoredRead(readIds);
  }, [readIds]);

  const notifications = useMemo(
    () => {
      const defaultNotifications: NotificationItem[] = [
        {
          id: "v1.2.0",
          title: t('notificationsBell.items.v1_2_0.title'),
          body: t('notificationsBell.items.v1_2_0.body'),
          date: "2025-12-01T09:00:00.000Z",
        },
        {
          id: "contracts-dashboard",
          title: t('notificationsBell.items.contractsDashboard.title'),
          body: t('notificationsBell.items.contractsDashboard.body'),
          date: "2025-11-20T12:00:00.000Z",
        },
        {
          id: "csv-updates",
          title: t('notificationsBell.items.csvUpdates.title'),
          body: t('notificationsBell.items.csvUpdates.body'),
          date: "2025-11-05T08:30:00.000Z",
        },
      ];
      return [...defaultNotifications].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
    },
    [t]
  );

  const unreadCount = useMemo(
    () => notifications.filter((n) => !readIds.includes(n.id)).length,
    [notifications, readIds]
  );

  const markAllRead = () => {
    setReadIds(notifications.map((n) => n.id));
    showSuccess(t('notificationsBell.markAllReadButton'));
  };

  const toggleRead = (id: string) => {
    setReadIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t('notificationsBell.ariaLabel')}
          className="relative"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span
              aria-label={t('notificationsBell.unreadCount').replace('{count}', String(unreadCount))}
              className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-warning ring-2 ring-background"
            />
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('notificationsBell.dialogTitle')}</DialogTitle>
          <DialogDescription>
            {t('notificationsBell.dialogDescription')}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between gap-3">
          <div className="text-xs text-muted-foreground">
            {unreadCount > 0
              ? t('notificationsBell.unreadCount').replace('{count}', String(unreadCount))
              : t('notificationsBell.noUnread')}
          </div>
          {unreadCount > 0 && (
            <Button
              variant="secondary"
              size="sm"
              onClick={markAllRead}
              className="text-xs"
            >
              <Check className="mr-1.5 h-3.5 w-3.5" />
              {t('notificationsBell.markAllReadButton')}
            </Button>
          )}
        </div>

        <ScrollArea className="mt-2 max-h-80">
          <ul className="space-y-2">
            {notifications.map((n) => {
              const unread = !readIds.includes(n.id);
              return (
                <li
                  key={n.id}
                  className="rounded-md border bg-muted/30 p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-semibold">
                        {n.title}
                      </h4>
                      {unread && (
                        <Badge variant="destructive" className="h-5">
                          {t('notificationsBell.newBadge')}
                        </Badge>
                      )}
                    </div>
                    <span className="text-[11px] text-muted-foreground">
                      {new Date(n.date).toLocaleDateString("de-DE")}
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm text-muted-foreground">{n.body}</p>
                  <div className="mt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      onClick={() => toggleRead(n.id)}
                    >
                      <Check className="mr-1.5 h-3.5 w-3.5" />
                      {unread ? t('notificationsBell.markReadButton') : t('notificationsBell.markUnreadButton')}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}