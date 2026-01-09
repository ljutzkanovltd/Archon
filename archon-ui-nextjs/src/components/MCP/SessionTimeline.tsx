"use client";

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { HiCheckCircle, HiXCircle, HiClock, HiZoomIn, HiZoomOut, HiRefresh } from "react-icons/hi";
import { useSessionDetails } from "@/hooks/useMcpQueries";
import type { McpRequest } from "@/lib/types";

interface SessionTimelineProps {
  sessionId: string;
  height?: number;
  className?: string;
}

export function SessionTimeline({ sessionId, height = 400, className = "" }: SessionTimelineProps) {
  const { data: sessionDetails, isLoading, error, refetch } = useSessionDetails(sessionId);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [selectedEvent, setSelectedEvent] = useState<McpRequest | null>(null);

  // Calculate timeline data
  const timelineData = useMemo(() => {
    if (!sessionDetails?.requests || sessionDetails.requests.length === 0) return null;

    const requests = [...sessionDetails.requests].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    const startTime = new Date(requests[0].timestamp).getTime();
    const endTime = new Date(requests[requests.length - 1].timestamp).getTime();
    const duration = endTime - startTime || 1;

    return {
      requests,
      startTime,
      endTime,
      duration,
    };
  }, [sessionDetails?.requests]);

  // Calculate position on timeline (0-100%)
  const getPosition = (timestamp: string): number => {
    if (!timelineData) return 0;
    const time = new Date(timestamp).getTime();
    const position = ((time - timelineData.startTime) / timelineData.duration) * 100;
    return Math.max(0, Math.min(100, position));
  };

  // Format time for display
  const formatTime = (timestamp: string): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  // Format duration
  const formatDuration = (ms: number | null): string => {
    if (ms === null) return "N/A";
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  // Get event color based on status
  const getEventColor = (request: McpRequest) => {
    switch (request.status) {
      case "success":
        return "bg-green-500 border-green-600";
      case "error":
        return "bg-red-500 border-red-600";
      case "timeout":
        return "bg-orange-500 border-orange-600";
      default:
        return "bg-gray-500 border-gray-600";
    }
  };

  // Get event icon
  const getEventIcon = (request: McpRequest) => {
    switch (request.status) {
      case "success":
        return <HiCheckCircle className="w-4 h-4 text-white" />;
      case "error":
        return <HiXCircle className="w-4 h-4 text-white" />;
      case "timeout":
        return <HiClock className="w-4 h-4 text-white" />;
      default:
        return null;
    }
  };

  // Zoom controls
  const handleZoomIn = () => setZoomLevel((prev) => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setZoomLevel((prev) => Math.max(prev - 0.25, 0.5));
  const handleResetZoom = () => setZoomLevel(1);

  if (isLoading) {
    return (
      <div
        className={`p-8 text-center rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 ${className}`}
        style={{ height }}
      >
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-3"></div>
        <p className="text-gray-600 dark:text-gray-400">Loading timeline...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={`p-8 text-center rounded-lg bg-white dark:bg-gray-800 border border-red-200 dark:border-red-700 ${className}`}
        style={{ height }}
      >
        <HiXCircle className="w-12 h-12 mx-auto mb-3 text-red-500" />
        <p className="text-red-600 dark:text-red-400 font-medium mb-2">Failed to load timeline</p>
        <p className="text-sm text-gray-500 dark:text-gray-500">{error.message}</p>
        <button
          onClick={() => refetch()}
          className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <HiRefresh className="w-4 h-4" />
          Retry
        </button>
      </div>
    );
  }

  if (!timelineData || timelineData.requests.length === 0) {
    return (
      <div
        className={`p-8 text-center rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 ${className}`}
        style={{ height }}
      >
        <HiClock className="w-12 h-12 mx-auto mb-3 text-gray-400 dark:text-gray-500" />
        <p className="text-gray-600 dark:text-gray-400 font-medium">No events yet</p>
        <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
          Timeline will populate when requests are made
        </p>
      </div>
    );
  }

  return (
    <div className={`rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 ${className}`}>
      {/* Header with controls */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Session Timeline</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {timelineData.requests.length} events •{" "}
            {new Date(timelineData.endTime - timelineData.startTime).toISOString().substr(11, 8)} duration
          </p>
        </div>

        {/* Zoom controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleZoomOut}
            disabled={zoomLevel <= 0.5}
            className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Zoom out"
          >
            <HiZoomOut className="w-5 h-5" />
          </button>
          <span className="text-sm font-mono text-gray-600 dark:text-gray-400 min-w-[60px] text-center">
            {Math.round(zoomLevel * 100)}%
          </span>
          <button
            onClick={handleZoomIn}
            disabled={zoomLevel >= 3}
            className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Zoom in"
          >
            <HiZoomIn className="w-5 h-5" />
          </button>
          <button
            onClick={handleResetZoom}
            className="px-3 py-2 text-sm rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            title="Reset zoom"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Timeline */}
      <div className="p-6 overflow-x-auto" style={{ height: height - 80 }}>
        <div
          className="relative"
          style={{
            width: `${100 * zoomLevel}%`,
            minWidth: "100%",
            height: "100%",
          }}
        >
          {/* Timeline base line */}
          <div className="absolute top-1/2 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-full transform -translate-y-1/2" />

          {/* Start marker */}
          <div className="absolute top-1/2 left-0 transform -translate-y-1/2">
            <div className="w-3 h-3 rounded-full bg-blue-600 border-2 border-white dark:border-gray-800 shadow-lg" />
            <div className="absolute top-6 left-1/2 transform -translate-x-1/2 whitespace-nowrap">
              <p className="text-xs font-medium text-gray-700 dark:text-gray-300">Start</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {formatTime(timelineData.requests[0].timestamp)}
              </p>
            </div>
          </div>

          {/* End marker */}
          <div className="absolute top-1/2 right-0 transform -translate-y-1/2">
            <div className="w-3 h-3 rounded-full bg-pink-600 border-2 border-white dark:border-gray-800 shadow-lg" />
            <div className="absolute top-6 right-0 whitespace-nowrap">
              <p className="text-xs font-medium text-gray-700 dark:text-gray-300">End</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {formatTime(timelineData.requests[timelineData.requests.length - 1].timestamp)}
              </p>
            </div>
          </div>

          {/* Events */}
          <AnimatePresence>
            {timelineData.requests.map((request, index) => {
              const position = getPosition(request.timestamp);
              const isAbove = index % 2 === 0;

              return (
                <motion.div
                  key={request.request_id}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  transition={{ delay: index * 0.05, duration: 0.3 }}
                  className="absolute top-1/2 transform -translate-x-1/2"
                  style={{ left: `${position}%` }}
                >
                  {/* Event dot */}
                  <motion.div
                    whileHover={{ scale: 1.3 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setSelectedEvent(request)}
                    className={`w-8 h-8 rounded-full ${getEventColor(request)} border-2 border-white dark:border-gray-800 shadow-lg cursor-pointer flex items-center justify-center transform -translate-y-1/2 hover:shadow-xl transition-shadow`}
                  >
                    {getEventIcon(request)}
                  </motion.div>

                  {/* Connecting line */}
                  <div
                    className={`absolute left-1/2 w-0.5 ${
                      isAbove ? "bottom-full mb-4" : "top-full mt-4"
                    } h-12 bg-gray-300 dark:bg-gray-600 transform -translate-x-1/2`}
                  />

                  {/* Event card */}
                  <motion.div
                    initial={{ y: isAbove ? -10 : 10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: index * 0.05 + 0.2 }}
                    className={`absolute left-1/2 transform -translate-x-1/2 ${
                      isAbove ? "bottom-full mb-16" : "top-full mt-16"
                    } w-48 p-3 rounded-lg bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 shadow-lg cursor-pointer hover:shadow-xl transition-shadow`}
                    onClick={() => setSelectedEvent(request)}
                  >
                    <p className="text-xs font-mono font-medium text-gray-900 dark:text-white truncate mb-1">
                      {request.tool_name || request.method}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                      {formatTime(request.timestamp)}
                    </p>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-600 dark:text-gray-400">
                        {formatDuration(request.duration_ms)}
                      </span>
                      <span className="font-medium text-green-600 dark:text-green-400">
                        ${request.estimated_cost.toFixed(6)}
                      </span>
                    </div>
                  </motion.div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>

      {/* Event detail modal */}
      <AnimatePresence>
        {selectedEvent && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
            onClick={() => setSelectedEvent(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">Event Details</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 font-mono mt-1">
                      {selectedEvent.request_id}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedEvent(null)}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    <HiXCircle className="w-6 h-6" />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Tool Name</p>
                    <p className="text-sm font-mono text-gray-900 dark:text-white">
                      {selectedEvent.tool_name || "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Method</p>
                    <p className="text-sm font-mono text-gray-900 dark:text-white">{selectedEvent.method}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Status</p>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${
                        selectedEvent.status === "success"
                          ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                          : selectedEvent.status === "error"
                          ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                          : "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400"
                      }`}
                    >
                      {getEventIcon(selectedEvent)}
                      {selectedEvent.status}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Duration</p>
                    <p className="text-sm font-mono text-gray-900 dark:text-white">
                      {formatDuration(selectedEvent.duration_ms)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Timestamp</p>
                    <p className="text-sm font-mono text-gray-900 dark:text-white">
                      {new Date(selectedEvent.timestamp).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Cost</p>
                    <p className="text-sm font-bold text-green-600 dark:text-green-400">
                      ${selectedEvent.estimated_cost.toFixed(6)}
                    </p>
                  </div>
                </div>

                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Token Usage</p>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700">
                      <p className="text-xs text-gray-500 dark:text-gray-400">Prompt</p>
                      <p className="text-lg font-bold text-gray-900 dark:text-white">
                        {selectedEvent.prompt_tokens.toLocaleString()}
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700">
                      <p className="text-xs text-gray-500 dark:text-gray-400">Completion</p>
                      <p className="text-lg font-bold text-gray-900 dark:text-white">
                        {selectedEvent.completion_tokens.toLocaleString()}
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700">
                      <p className="text-xs text-gray-500 dark:text-gray-400">Total</p>
                      <p className="text-lg font-bold text-gray-900 dark:text-white">
                        {selectedEvent.total_tokens.toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>

                {selectedEvent.error_message && (
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Error Message</p>
                    <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                      <p className="text-sm text-red-700 dark:text-red-400 font-mono whitespace-pre-wrap">
                        {selectedEvent.error_message}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
