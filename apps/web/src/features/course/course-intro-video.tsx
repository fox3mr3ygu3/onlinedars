import { toEmbedUrl } from '@/features/lesson/content';

/**
 * Course promo video on the public course page. YouTube / Vimeo links are embedded with their
 * player (YouTube via youtube-nocookie); any other https link plays in the native player.
 */
export function CourseIntroVideo({ url, title }: { url: string; title: string }) {
  if (!/^https?:\/\//i.test(url)) return null;
  const embed = toEmbedUrl(url);
  return (
    <div
      className="aspect-video overflow-hidden rounded-xl border bg-black"
      data-testid="course-intro-video"
    >
      {embed ? (
        <iframe
          src={embed}
          title={title}
          className="size-full"
          loading="lazy"
          allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      ) : (
        <video src={url} controls preload="metadata" className="size-full" />
      )}
    </div>
  );
}
