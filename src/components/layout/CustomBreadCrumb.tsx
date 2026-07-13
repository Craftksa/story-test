'use client';

import {usePathname} from 'next/navigation';
import {Breadcrumb, BreadcrumbItem, BreadcrumbList} from "@/components/ui/breadcrumb";
import {ChevronRightIcon} from "@radix-ui/react-icons";
import Link from "next/link";
import {useTranslations} from "use-intl";

const capitalize = (str: string) => {
  return str.replace(/\b\w/g, (char) => char.toUpperCase());
};

const CustomBreadcrumb = () => {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(segment => segment !== '');
  const t = useTranslations();

  const translatableSegments = ['projects', 'tasks', 'upload', 'new', 'edit', 'dashboard', 'users', 'contracts', 'installment'];

  const getLabel = (segment: string) =>
    translatableSegments.includes(segment.toLowerCase()) ? t(capitalize(segment)) : capitalize(segment);

  return (
    <Breadcrumb className="custom-breadcrumb hidden justify-center items-center leading-none md:flex">
      <BreadcrumbList className="sm:gap-1">
        {pathname === '/' && (
          <BreadcrumbItem className="font-medium text-foreground leading-none text-xs">
            {t("Home")}
          </BreadcrumbItem>
        )}
        {segments.map((segment, index) => (
          <BreadcrumbItem className="flex items-center gap-1 leading-none text-xs" key={segment}>
            {index === segments.length - 1 ? (
              <span className="font-medium text-foreground">{getLabel(segment)}</span>
            ) : (
              <Link href={`/${segments.slice(0, index + 1).join('/')}`}>
                {getLabel(segment)}
              </Link>
            )}
            {index !== segments.length - 1 && (
              <span>
                <ChevronRightIcon />
              </span>
            )}
          </BreadcrumbItem>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
};

export default CustomBreadcrumb;
