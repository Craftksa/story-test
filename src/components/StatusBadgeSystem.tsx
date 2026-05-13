import React from "react";
import {ActivityIcon, LucideIcon} from "lucide-react";
import {useTranslations} from "use-intl";


const StatusBadge = ({
                       status = "N/A",
                       color,
                       size,
                       sign = false,
                       Icon,
                     }: {
  status?: any;
  color?: any;
  size?: string,
  sign?: boolean;
  Icon?: LucideIcon;
}) => {
  const statusColors: Record<any, string> = {
    admin: "bg-rose-200 text-rose-700 border-rose-500/40 print:text-rose-500 dark:bg-rose-700/30 dark:text-rose-200 dark:border-rose-300/20",
    employee: "bg-green-200 text-green-700 border-green-500/40 print:text-green-500 dark:bg-green-700/30 dark:text-green-200 dark:border-green-300/20",
    moderator: "bg-amber-200 text-amber-700 border-amber-500/40 print:text-amber-500 dark:bg-amber-700/30 dark:text-amber-200 dark:border-amber-300/20",
    client: "bg-blue-200 text-blue-700 border-blue-500/40 print:text-blue-500 dark:bg-blue-700/30 dark:text-blue-200 dark:border-blue-300/20",

    Designer: "bg-green-200 text-green-700 border-green-500/40 print:text-green-500 dark:bg-green-700/30 dark:text-green-200 dark:border-green-300/20",
    Client: "bg-blue-200 text-blue-700 border-blue-500/40 print:text-blue-500 dark:bg-blue-700/30 dark:text-blue-200 dark:border-blue-300/20",

    Foundations: "bg-amber-200 text-amber-700 border-amber-500/40 print:text-amber-500 dark:bg-amber-700/30 dark:text-amber-200 dark:border-amber-300/20",
    Structural: "bg-amber-200 text-amber-700 border-amber-500/40 print:text-amber-500 dark:bg-amber-700/30 dark:text-amber-200 dark:border-amber-300/20",

    Finishes: "bg-lime-200 text-lime-700 border-lime-500/40 print:text-lime-500 dark:bg-lime-700/30 dark:text-lime-200 dark:border-lime-300/20",
    Architectural: "bg-lime-200 text-lime-700 border-lime-500/40 print:text-lime-500 dark:bg-lime-700/30 dark:text-lime-200 dark:border-lime-300/20",

    palace: "bg-violet-200 text-violet-700 border-violet-500/40 print:text-violet-500 dark:bg-violet-700/30 dark:text-violet-200 dark:border-violet-300/20",
    villa: "bg-teal-200 text-teal-700 border-teal-500/40 print:text-teal-500 dark:bg-teal-700/30 dark:text-teal-200 dark:border-teal-300/20",
    black: "bg-black/80 text-white border-white/30 print:text-black dark:bg-black/70 dark:text-white dark:border-white/20",

    'Not Started' : "bg-slate-200 text-slate-700 border-slate-500/40 print:text-slate-500 dark:bg-slate-700/30 dark:text-slate-200 dark:border-slate-300/20",
    'In Progress': "bg-blue-200 text-blue-700 border-blue-500/40 print:text-blue-500 dark:bg-blue-700/30 dark:text-blue-200 dark:border-blue-300/20",
    'Completed': "bg-green-200 text-green-700 border-green-500/40 print:text-green-500 dark:bg-green-700/30 dark:text-green-200 dark:border-green-300/20",
    'On Hold': "bg-rose-200 text-rose-700 border-rose-500/40 print:text-rose-500 dark:bg-rose-700/30 dark:text-rose-200 dark:border-rose-300/20",
    'Needs Review' : "bg-purple-200 text-purple-700 border-purple-500/40 print:text-purple-500 dark:bg-purple-700/30 dark:text-purple-200 dark:border-purple-300/20"
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
        statusColors[status] || statusColors[color] || "bg-slate-200 text-slate-700 border-slate-500/40 print:text-slate-500 dark:bg-slate-700/30 dark:text-slate-200 dark:border-slate-300/20"
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
