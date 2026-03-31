import Image from 'next/image';
import clsx from 'clsx';

interface AnamneoLogoProps {
  className?: string;
  iconClassName?: string;
  iconContainerClassName?: string;
  textClassName?: string;
  priority?: boolean;
}

export function AnamneoLogo({
  className,
  iconClassName,
  iconContainerClassName,
  textClassName,
  priority = false,
}: AnamneoLogoProps) {
  return (
    <div className={clsx('flex items-center gap-3', className)}>
      <span
        className={clsx(
          'flex shrink-0 items-center justify-center',
          iconContainerClassName
        )}
      >
        <Image
          src="/anamneo-logo.svg"
          alt=""
          width={96}
          height={96}
          priority={priority}
          className={clsx('h-10 w-auto', iconClassName)}
        />
      </span>
      <span
        className={clsx(
          'font-sans text-2xl font-semibold tracking-tight text-ink-primary',
          textClassName
        )}
      >
        Anamneo
      </span>
    </div>
  );
}