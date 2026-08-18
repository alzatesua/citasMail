declare module "react-big-calendar" {
  import type { ComponentType, CSSProperties } from "react";

  export const Views: {
    MONTH: "month";
    WEEK: "week";
    WORK_WEEK: "work_week";
    DAY: "day";
    AGENDA: "agenda";
  };

  export interface SlotInfo {
    start: Date;
    end: Date;
    slots: Date[];
    action: "select" | "click" | "doubleClick";
  }

  export interface CalendarProps<TEvent extends object = object> {
    localizer: unknown;
    culture?: string;
    messages?: Record<string, unknown>;
    events?: TEvent[];
    date?: Date;
    defaultView?: string;
    views?: string[];
    selectable?: boolean;
    onNavigate?: (newDate: Date) => void;
    onSelectSlot?: (slotInfo: SlotInfo) => void;
    onSelectEvent?: (event: TEvent) => void;
    eventPropGetter?: (event: TEvent) => { style?: CSSProperties; className?: string };
    style?: CSSProperties;
  }

  export const Calendar: ComponentType<CalendarProps>;

  export function dateFnsLocalizer(config: {
    format: unknown;
    parse: unknown;
    startOfWeek: unknown;
    getDay: unknown;
    locales: Record<string, unknown>;
  }): unknown;
}
