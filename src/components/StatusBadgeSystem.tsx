import React from "react";
import {LucideIcon} from "lucide-react";
import {useTranslations} from "use-intl";


const StatusBadge = ({
                       status = "N/A",
                       color,
                       size,
                       sign = false,
                       Icon,
                     }: {
  status?: string;
  color?: string;
  size?: string,
  sign?: boolean;
  Icon?: LucideIcon;
}) => {
  const statusColors: Record<string, string> = {
    admin: "bg-rose-100 text-rose-900 border-rose-300 print:text-rose-700 dark:bg-rose-950/35 dark:text-rose-200 dark:border-rose-400/30",
    employee: "bg-green-100 text-green-900 border-green-300 print:text-green-700 dark:bg-green-950/35 dark:text-green-200 dark:border-green-400/30",
    moderator: "bg-amber-100 text-amber-900 border-amber-300 print:text-amber-700 dark:bg-amber-950/35 dark:text-amber-200 dark:border-amber-400/30",
    client: "bg-blue-100 text-blue-900 border-blue-300 print:text-blue-700 dark:bg-blue-950/35 dark:text-blue-200 dark:border-blue-400/30",

    Designer: "bg-green-100 text-green-900 border-green-300 print:text-green-700 dark:bg-green-950/35 dark:text-green-200 dark:border-green-400/30",
    Client: "bg-blue-100 text-blue-900 border-blue-300 print:text-blue-700 dark:bg-blue-950/35 dark:text-blue-200 dark:border-blue-400/30",

    Foundations: "bg-amber-100 text-amber-900 border-amber-300 print:text-amber-700 dark:bg-amber-950/35 dark:text-amber-200 dark:border-amber-400/30",
    Structural: "bg-amber-100 text-amber-900 border-amber-300 print:text-amber-700 dark:bg-amber-950/35 dark:text-amber-200 dark:border-amber-400/30",

    Finishes: "bg-lime-100 text-lime-900 border-lime-300 print:text-lime-700 dark:bg-lime-950/35 dark:text-lime-200 dark:border-lime-400/30",
    Architectural: "bg-lime-100 text-lime-900 border-lime-300 print:text-lime-700 dark:bg-lime-950/35 dark:text-lime-200 dark:border-lime-400/30",

    palace: "bg-violet-100 text-violet-900 border-violet-300 print:text-violet-700 dark:bg-violet-950/35 dark:text-violet-200 dark:border-violet-400/30",
    villa: "bg-teal-100 text-teal-900 border-teal-300 print:text-teal-700 dark:bg-teal-950/35 dark:text-teal-200 dark:border-teal-400/30",
    black: "bg-black/80 text-white border-white/30 print:text-black dark:bg-black/70 dark:text-white dark:border-white/20",

    'Not Started' : "bg-slate-100 text-slate-900 border-slate-300 print:text-slate-700 dark:bg-slate-900/45 dark:text-slate-200 dark:border-slate-400/30",
    'In Progress': "bg-blue-100 text-blue-900 border-blue-300 print:text-blue-700 dark:bg-blue-950/35 dark:text-blue-200 dark:border-blue-400/30",
    'Completed': "bg-green-100 text-green-900 border-green-300 print:text-green-700 dark:bg-green-950/35 dark:text-green-200 dark:border-green-400/30",
    'On Hold': "bg-rose-100 text-rose-900 border-rose-300 print:text-rose-700 dark:bg-rose-950/35 dark:text-rose-200 dark:border-rose-400/30",
    'Needs Review' : "bg-purple-100 text-purple-900 border-purple-300 print:text-purple-700 dark:bg-purple-950/35 dark:text-purple-200 dark:border-purple-400/30"
  };

  const t = useTranslations();
  return (
    <div
      className={`
      text-center self-center
        inline-flex
        items-center
        border
        px-2 
        py-2
        pt-2.5
        w-fit
        rounded-none 
        ${size ? size : 'text-[10px]'}
       
        uppercase 
        tracking-wider
        leading-[0px]
        transition-colors 
        duration-200 
        ease-in-out 
        hover:opacity-80
        print:text-gray-950
        print:bg-white
        print:border-muted-foreground/50
      ${
        statusColors[status] || statusColors[color ?? ''] || "bg-slate-100 text-slate-900 border-slate-300 print:text-slate-700 dark:bg-slate-900/45 dark:text-slate-200 dark:border-slate-400/30"
      }`}
    >
      {Icon && <Icon className="w-3 h-3 animate-spin leading-[0px]" />}
      {/*{icons[status]}*/}
      {t(status)}
      {sign && status === "active" && (
        <div className="flex justify-center items-center mx-2 print:hidden">
          <div className="bg-cyan-500 text-cyan-500 w-2 h-2 p-1 rounded-full animate-ping"></div>
          <div className="bg-cyan-500 text-cyan-500 w-2 h-2 rounded-full -mx-2"></div>
        </div>
      )}

    </div>
  );
};

export default StatusBadge;
