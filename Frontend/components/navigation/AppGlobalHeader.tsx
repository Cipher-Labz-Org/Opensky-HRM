"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as Popover from "@radix-ui/react-popover";
import { ROUTES } from "@/config/routes";
import { API_BASE_URL } from "@/config/constants";
import { usePeopleHubHelp } from "@/components/help/PeopleHubHelpPanel";

const iconStroke = 1.75;

const iconBtn =
  "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-600 outline-none transition hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-[#2E7BBF]/30";

function Divider() {
  return <span className="mx-1.5 hidden h-5 w-px shrink-0 bg-slate-200 sm:block" aria-hidden />;
}

export type AppGlobalHeaderUser = {
  username: string;
  email: string;
  employeeName: string | null;
  profileImageUrl: string | null;
};

type AppGlobalHeaderProps = {
  user: AppGlobalHeaderUser;
  onLogout: () => void;
};

export function AppGlobalHeader({ user, onLogout }: AppGlobalHeaderProps) {
  const pathname = usePathname() ?? "";
  const isPeopleSection = pathname === ROUTES.people || pathname.startsWith(`${ROUTES.people}/`);
  const { open: openPeopleHubHelp } = usePeopleHubHelp();

  const displayName = user.employeeName?.trim() || user.username;
  const initials = displayName
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const [langOpen, setLangOpen] = React.useState(false);
  const [accountOpen, setAccountOpen] = React.useState(false);

  return (
    <header
      className="sticky top-0 z-[45] flex h-[60px] shrink-0 items-center justify-end border-b border-slate-200/90 bg-white px-4 sm:px-6"
      role="banner"
    >
      <div className="flex items-center gap-0.5 sm:gap-1">
        <Link
          href={ROUTES.leave}
          className={iconBtn}
          title="Leave & calendar"
          aria-label="Leave and team calendar"
        >
          <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={iconStroke} viewBox="0 0 24 24" aria-hidden>
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
        </Link>

        <button type="button" className={iconBtn} title="Notifications" aria-label="Notifications">
          <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={iconStroke} viewBox="0 0 24 24" aria-hidden>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
            />
          </svg>
        </button>

        {isPeopleSection ? (
          <button
            type="button"
            className={iconBtn}
            title="People Hub help"
            aria-label="People Hub help"
            onClick={() => openPeopleHubHelp()}
          >
            <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={iconStroke} viewBox="0 0 24 24" aria-hidden>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z"
              />
            </svg>
          </button>
        ) : (
          <Link href={ROUTES.contact} className={iconBtn} title="Help & support" aria-label="Help and support">
            <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={iconStroke} viewBox="0 0 24 24" aria-hidden>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z"
              />
            </svg>
          </Link>
        )}

        <Link href={ROUTES.reports} className={iconBtn} title="Reports & feeds" aria-label="Reports and feeds">
          <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={iconStroke} viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 5c7.18 0 13 5.82 13 13M6 11a7 7 0 017 7" />
            <circle cx="6" cy="19" r="1.25" fill="currentColor" stroke="none" />
          </svg>
        </Link>

        <Divider />

        <Popover.Root open={langOpen} onOpenChange={setLangOpen}>
          <Popover.Trigger asChild>
            <button
              type="button"
              className="rounded-lg px-2.5 py-1.5 text-sm font-bold tracking-wide text-slate-800 outline-none transition hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-[#2E7BBF]/30"
              aria-label="Language"
            >
              EN
            </button>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content
              className="z-[10050] min-w-[10rem] rounded-xl border border-slate-200/90 bg-white p-2 shadow-lg shadow-slate-900/10 outline-none"
              sideOffset={6}
              align="end"
              collisionPadding={12}
            >
              <p className="px-2 py-1.5 text-xs font-semibold text-slate-500">Language</p>
              <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm font-medium text-slate-800">English</div>
              <p className="mt-2 px-2 text-[11px] leading-snug text-slate-400">More languages can be added when i18n is enabled.</p>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>

        <Divider />

        <Popover.Root open={accountOpen} onOpenChange={setAccountOpen}>
          <Popover.Trigger asChild>
            <button
              type="button"
              className="flex max-w-[200px] items-center gap-2 rounded-lg py-1.5 pl-2 pr-1 text-left outline-none transition hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-[#2E7BBF]/30"
              aria-label="Account menu"
            >
              {user.profileImageUrl ? (
                <img
                  src={`${API_BASE_URL}${user.profileImageUrl}`}
                  alt=""
                  className="h-8 w-8 shrink-0 rounded-full object-cover ring-1 ring-slate-200"
                />
              ) : (
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#E8192C] to-[#2E7BBF] text-[10px] font-bold text-white">
                  {initials}
                </span>
              )}
              <span className="truncate text-sm font-normal text-slate-700">{displayName}</span>
              <svg className="h-4 w-4 shrink-0 text-slate-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content
              className="z-[10050] w-[min(100vw-2rem,16rem)] rounded-xl border border-slate-200/90 bg-white p-1.5 shadow-lg shadow-slate-900/10 outline-none"
              sideOffset={8}
              align="end"
              collisionPadding={12}
            >
              <p className="truncate px-2.5 pb-1 pt-1 text-xs text-slate-500">{user.email}</p>
              <Link
                href={ROUTES.employeeProfile}
                className="block rounded-lg px-2.5 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
                onClick={() => setAccountOpen(false)}
              >
                Employee bio
              </Link>
              <button
                type="button"
                className="w-full rounded-lg px-2.5 py-2 text-left text-sm text-red-600 transition hover:bg-red-50"
                onClick={() => {
                  setAccountOpen(false);
                  onLogout();
                }}
              >
                Sign out
              </button>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      </div>
    </header>
  );
}
