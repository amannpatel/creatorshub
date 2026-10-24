"use client";

import { ChevronDown, Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuGroup,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusBadge } from "@/components/common";
import { useServerAction } from "@/components/use-server-action";
import { setCollabStatus } from "@/server/actions/collaborations";
import { COLLAB_STATUSES, STATUS_META, type CollabStatus } from "@/lib/constants";
import { TONE_DOT } from "@/lib/tone";
import { cn } from "@/lib/utils";

export function StatusMenu({ id, status, size = "default" }: { id: string; status: CollabStatus; size?: "default" | "lg" }) {
  const { pending, run } = useServerAction();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            disabled={pending}
            aria-label={`Status: ${STATUS_META[status].label}. Change status`}
            className={cn("inline-flex items-center gap-0.5 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring", size === "lg" && "scale-110")}
          />
        }
      >
        <StatusBadge status={status} />
        {pending ? <Loader2 className="size-3 animate-spin text-muted-foreground" /> : <ChevronDown className="size-3 text-muted-foreground" />}
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-52">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Move to</DropdownMenuLabel>
          {COLLAB_STATUSES.map((s, i) => (
            <div key={s}>
              {(i === 3 || i === 6) && <DropdownMenuSeparator />}
              <DropdownMenuItem
                disabled={s === status}
                onClick={() => run(() => setCollabStatus(id, s), { success: `Moved to ${STATUS_META[s].label}` })}
              >
                <span className={cn("size-2 rounded-full", TONE_DOT[STATUS_META[s].tone])} />
                {STATUS_META[s].label}
                {s === status && <span className="ml-auto text-xs text-muted-foreground">current</span>}
              </DropdownMenuItem>
            </div>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
