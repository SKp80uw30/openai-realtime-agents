"use client";

import React, { createContext, useContext, useState, useCallback, FC, PropsWithChildren } from "react";
import { v4 as uuidv4 } from "uuid";
import { LoggedEvent } from "@/app/types";

type EventContextValue = {
  loggedEvents: LoggedEvent[];
  logClientEvent: (eventObj: Record<string, any>, eventNameSuffix?: string) => void;
  logServerEvent: (eventObj: Record<string, any>, eventNameSuffix?: string) => void;
  logHistoryItem: (item: any) => void;
  toggleExpand: (id: number | string) => void;
};

const EventContext = createContext<EventContextValue | undefined>(undefined);

export const EventProvider: FC<PropsWithChildren> = ({ children }) => {
  const [loggedEvents, setLoggedEvents] = useState<LoggedEvent[]>([]);

  function addLoggedEvent(direction: "client" | "server", eventName: string, eventData: Record<string, any>) {
    const id = eventData.event_id || eventData.id || uuidv4();

    setLoggedEvents((prev) => {
      const existing = prev.find((log) => log.id === id);
      if (existing) {
        return prev.map((log) =>
          log.id === id
            ? {
                ...log,
                direction,
                eventName,
                eventData,
                timestamp: new Date().toLocaleTimeString(),
              }
            : log,
        );
      }

      return [
        ...prev,
        {
          id,
          direction,
          eventName,
          eventData,
          timestamp: new Date().toLocaleTimeString(),
          expanded: false,
        },
      ];
    });
  }

  const logClientEvent: EventContextValue["logClientEvent"] = useCallback((eventObj, eventNameSuffix = "") => {
    const name = `${eventObj.type || ""} ${eventNameSuffix || ""}`.trim();
    addLoggedEvent("client", name, eventObj);
  }, []);

  const logServerEvent: EventContextValue["logServerEvent"] = useCallback((eventObj, eventNameSuffix = "") => {
    const noisyDeltaTypes = new Set([
      'conversation.item.input_audio_transcription.delta',
      'response.text.delta',
      'response.mcp_call_arguments.delta',
      'response.mcp_call_function.delta',
    ] as const);

    if (noisyDeltaTypes.has(eventObj.type as any)) return;

    const name = `${eventObj.type || ""} ${eventNameSuffix || ""}`.trim();
    addLoggedEvent("server", name, eventObj);
  }, []);

  const logHistoryItem: EventContextValue['logHistoryItem'] = useCallback((item) => {
    let eventName = item.type;
    if (item.type === 'message') {
      eventName = `${item.role}.${item.status}`;
    }
    if (item.type === 'function_call') {
      eventName = `function.${item.name}.${item.status}`;
    }
    addLoggedEvent('server', eventName, item);
  }, []);

  const toggleExpand: EventContextValue['toggleExpand'] = useCallback((id) => {
    setLoggedEvents((prev) =>
      prev.map((log) => {
        if (log.id === id) {
          return { ...log, expanded: !log.expanded };
        }
        return log;
      })
    );
  }, []);


  return (
    <EventContext.Provider
      value={{ loggedEvents, logClientEvent, logServerEvent, logHistoryItem, toggleExpand }}
    >
      {children}
    </EventContext.Provider>
  );
};

export function useEvent() {
  const context = useContext(EventContext);
  if (!context) {
    throw new Error("useEvent must be used within an EventProvider");
  }
  return context;
}
