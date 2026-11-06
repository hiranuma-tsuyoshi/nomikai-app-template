type IconProps = {
  className?: string;
};

function iconProps(className?: string) {
  return {
    "aria-hidden": true,
    focusable: false,
    className,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2.4,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
}

export function ArrowRightIcon({ className }: IconProps) {
  return (
    <svg {...iconProps(className)}>
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  );
}

export function CheckIcon({ className }: IconProps) {
  return (
    <svg {...iconProps(className)}>
      <path d="m5 12 4.2 4.2L19 6.5" />
    </svg>
  );
}

export function ClockIcon({ className }: IconProps) {
  return (
    <svg {...iconProps(className)}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  );
}

export function PencilIcon({ className }: IconProps) {
  return (
    <svg {...iconProps(className)}>
      <path d="m4 20 4.2-1 10.6-10.6a2.1 2.1 0 0 0-3-3L5.2 16 4 20Z" />
      <path d="m14.5 6.5 3 3" />
    </svg>
  );
}

export function LockIcon({ className }: IconProps) {
  return (
    <svg {...iconProps(className)}>
      <rect x="5" y="10" width="14" height="10" rx="2.5" />
      <path d="M8.5 10V7.5a3.5 3.5 0 0 1 7 0V10" />
    </svg>
  );
}

export function UsersIcon({ className }: IconProps) {
  return (
    <svg {...iconProps(className)}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
      <path d="M16 5.4a3 3 0 0 1 0 5.2" />
      <path d="M17.5 14.2a5.2 5.2 0 0 1 3 4.8" />
    </svg>
  );
}

export function WifiOffIcon({ className }: IconProps) {
  return (
    <svg {...iconProps(className)}>
      <path d="M3 3l18 18" />
      <path d="M8.5 8.6A11.5 11.5 0 0 1 21 10.2" />
      <path d="M5 10.2a11.5 11.5 0 0 1 1.7-.8" />
      <path d="M8.5 13.5a6.5 6.5 0 0 1 7.4 1" />
      <path d="M11.8 17a1.6 1.6 0 0 1 2.4 1.4" />
      <path d="M12 17h.01" />
    </svg>
  );
}

export function XIcon({ className }: IconProps) {
  return (
    <svg {...iconProps(className)}>
      <path d="m6 6 12 12" />
      <path d="m18 6-12 12" />
    </svg>
  );
}

export function SparklesIcon({ className }: IconProps) {
  return (
    <svg {...iconProps(className)}>
      <path d="M12 3.5 13.6 9 19 10.6 13.6 12.2 12 17.7 10.4 12.2 5 10.6 10.4 9 12 3.5Z" />
      <path d="M18.5 15.5 19.2 18l2.3.7-2.3.8-.7 2.5-.8-2.5-2.2-.8 2.2-.7.8-2.5Z" />
    </svg>
  );
}

export function RefreshIcon({ className }: IconProps) {
  return (
    <svg {...iconProps(className)}>
      <path d="M20 11a8 8 0 0 0-14.7-4L4 9" />
      <path d="M4 4v5h5" />
      <path d="M4 13a8 8 0 0 0 14.7 4L20 15" />
      <path d="M20 20v-5h-5" />
    </svg>
  );
}

export function AlertTriangleIcon({ className }: IconProps) {
  return (
    <svg {...iconProps(className)}>
      <path d="M12 4.2 21 19.5H3L12 4.2Z" />
      <path d="M12 9.5v4.5" />
      <path d="M12 17.4h.01" />
    </svg>
  );
}

export function PlusIcon({ className }: IconProps) {
  return (
    <svg {...iconProps(className)}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

export function TrashIcon({ className }: IconProps) {
  return (
    <svg {...iconProps(className)}>
      <path d="M4 7h16" />
      <path d="M9 7V4.8h6V7" />
      <path d="m6.5 7 .8 12.2h9.4L17.5 7" />
      <path d="M10 11v4.5" />
      <path d="M14 11v4.5" />
    </svg>
  );
}

export function ChevronUpIcon({ className }: IconProps) {
  return (
    <svg {...iconProps(className)}>
      <path d="m5 15 7-7 7 7" />
    </svg>
  );
}

export function ChevronDownIcon({ className }: IconProps) {
  return (
    <svg {...iconProps(className)}>
      <path d="m5 9 7 7 7-7" />
    </svg>
  );
}

export function PlayIcon({ className }: IconProps) {
  return (
    <svg {...iconProps(className)}>
      <path d="M7 4.8v14.4L19.5 12 7 4.8Z" />
    </svg>
  );
}

export function StopIcon({ className }: IconProps) {
  return (
    <svg {...iconProps(className)}>
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}
