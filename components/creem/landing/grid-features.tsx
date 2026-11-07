import { cn } from "@/lib/utils";

import {
  IconArrowsSplit2,
  IconBrandYoutube,
  IconEaseInOut,
  IconHelp,
  IconTerminal2,
  IconZoomIn,
} from "@tabler/icons-react";

// NOTE: legacy SaaS-template grid, not rendered by the marketing home page.
// Descriptions were rewritten to reflect only features that actually exist,
// so this file can never advertise "payments in seconds" or "built-in email"
// if someone re-mounts it in the future.
export const GridFeatures = () => {
  const features = [
    {
      title: "Interactive globe",
      description:
        "Pick any date and explore geolocated historical events on a 3D globe. Free, no account needed.",
      icon: <IconTerminal2 />,
    },
    {
      title: "Real archival photos",
      description:
        "A slideshow of freely licensed photographs with per-image credits. No generated imagery, no video.",
      icon: <IconEaseInOut />,
    },
    {
      title: "Open, cited data",
      description:
        "Every event links back to its Wikipedia source; World Heritage sites come from UNESCO open data.",
      icon: <IconBrandYoutube />,
    },
    {
      title: "Right Now",
      description: "See a street-level photo, local time and live weather for any place — then compare it with the past.",
      icon: <IconArrowsSplit2 />,
    },
    {
      title: "Built for classrooms",
      description:
        "Presentation / large-type mode and CSV export with source links, ready for a projector.",
      icon: <IconBrandYoutube />,
    },
    {
      title: "One small pass, no subscription",
      description: "The planned $4 Archival Pass is a one-time purchase. Checkout is not enabled yet — no payment is collected today.",
      icon: <IconZoomIn />,
    }
  ];
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3  relative z-10 py-10">
      {features.map((feature, index) => (
        <Feature key={feature.title} {...feature} index={index} />
      ))}
    </div>
  );
};

const Feature = ({
  title,
  description,
  icon,
  index,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  index: number;
}) => {
  return (
    <div
      className={cn(
        "flex flex-col lg:border-r  py-10 relative group dark:border-neutral-800",
        (index === 0 || index === 4) && "lg:border-l dark:border-neutral-800",
        index < 3 && "lg:border-b dark:border-neutral-800"
      )}
    >
      {index < 3 && (
        <div className="opacity-0 group-hover:opacity-100 transition duration-200 group absolute inset-0 h-full w-full bg-gradient-to-t from-neutral-100 dark:from-neutral-800 to-transparent pointer-events-none" />
      )}
      {index >= 3 && (
        <div className="opacity-0 group-hover:opacity-100 transition duration-200 group absolute inset-0 h-full w-full bg-gradient-to-b from-neutral-100 dark:from-neutral-800 to-transparent pointer-events-none" />
      )}
      <div className="mb-4 relative z-10 px-10">{icon}</div>
      <div className="text-lg font-bold mb-2 relative z-10 px-10">
        <div className="absolute left-0 inset-y-0 h-6 w-1 rounded-tr-full rounded-br-full bg-neutral-300 dark:bg-neutral-700 group-hover:bg-[#ffbe98] transition duration-200" />
        <span className="group-hover:translate-x-2 transition duration-200 inline-block">
          {title}
        </span>
      </div>
      <p className="text-sm max-w-xs mx-auto relative z-10">
        {description}
      </p>
    </div>
  );
};
