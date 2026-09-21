import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { ADMIN_NAV } from "./adminNav";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function AdminCommandPalette({ open, onOpenChange }: Props) {
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search admin pages..." />
      <CommandList>
        <CommandEmpty>No pages found.</CommandEmpty>
        {ADMIN_NAV.map((section) => (
          <CommandGroup key={section.title} heading={section.title}>
            {section.items.map((item) => (
              <CommandItem
                key={item.url}
                value={`${section.title} ${item.title}`}
                onSelect={() => {
                  onOpenChange(false);
                  navigate(item.url);
                }}
              >
                <item.icon className="mr-2 h-4 w-4" />
                <span>{item.title}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  );
}
