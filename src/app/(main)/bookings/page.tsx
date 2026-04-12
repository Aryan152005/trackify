"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspaceId, useRequireRole } from "@/lib/workspace/hooks";
import {
  createResource,
  deleteResource,
  createBooking,
  cancelBooking,
  getBookings,
  getResources,
} from "@/lib/bookings/actions";
import {
  AnimatedPage,
  AnimatedList,
  AnimatedItem,
} from "@/components/ui/animated-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookingForm } from "@/components/bookings/booking-form";
import { EmptyState } from "@/components/ui/empty-state";
import { Ticket } from "lucide-react";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { PageHeader } from "@/components/ui/page-header";
import {
  Plus,
  Trash2,
  CalendarRange,
  Building2,
  Monitor,
  User,
  Clock,
  X,
  Filter,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import type { BookableResource, Booking } from "@/lib/types/calendar";

const TYPE_ICONS: Record<string, React.ReactNode> = {
  room: <Building2 className="h-5 w-5 text-blue-500" />,
  equipment: <Monitor className="h-5 w-5 text-amber-500" />,
  person: <User className="h-5 w-5 text-green-500" />,
  slot: <Clock className="h-5 w-5 text-purple-500" />,
};

const STATUS_COLORS: Record<string, string> = {
  confirmed:
    "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  pending:
    "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  cancelled: "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

export default function BookingsPage() {
  const workspaceId = useWorkspaceId();
  const isAdmin = useRequireRole("admin");

  const [resources, setResources] = useState<BookableResource[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  // UI state
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [showResourceForm, setShowResourceForm] = useState(false);
  const [filterResourceId, setFilterResourceId] = useState<string>("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

  // New resource form state
  const [newResourceName, setNewResourceName] = useState("");
  const [newResourceType, setNewResourceType] = useState<
    "room" | "equipment" | "person" | "slot"
  >("room");
  const [newResourceDescription, setNewResourceDescription] = useState("");
  const [addingResource, setAddingResource] = useState(false);

  const supabase = createClient();

  // Get current user
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id);
    });
  }, []);

  // Load data
  const loadData = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    try {
      const [resourcesData, bookingsData] = await Promise.all([
        getResources(workspaceId),
        getBookings(workspaceId),
      ]);
      setResources(resourcesData ?? []);
      setBookings(bookingsData ?? []);
    } catch (err) {
      console.error("Failed to load bookings data:", err);
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handlers
  async function handleAddResource(e: React.FormEvent) {
    e.preventDefault();
    if (!workspaceId || !newResourceName.trim()) return;
    setAddingResource(true);
    try {
      await createResource(workspaceId, {
        name: newResourceName.trim(),
        type: newResourceType,
        description: newResourceDescription.trim() || undefined,
      });
      setNewResourceName("");
      setNewResourceDescription("");
      setNewResourceType("room");
      setShowResourceForm(false);
      await loadData();
    } finally {
      setAddingResource(false);
    }
  }

  async function handleDeleteResource(resourceId: string) {
    if (!window.confirm("Delete this resource? All related bookings will also be removed."))
      return;
    await deleteResource(resourceId);
    await loadData();
  }

  async function handleBookResource(data: {
    resource_id: string;
    start_time: string;
    end_time: string;
    notes: string;
  }) {
    if (!workspaceId) return;
    await createBooking({
      workspace_id: workspaceId,
      resource_id: data.resource_id,
      start_time: data.start_time,
      end_time: data.end_time,
      notes: data.notes || undefined,
    });
    setShowBookingForm(false);
    await loadData();
  }

  async function handleCancelBooking(bookingId: string) {
    await cancelBooking(bookingId);
    await loadData();
  }

  // Filtering
  const filteredBookings = bookings.filter((b) => {
    if (b.status === "cancelled") return false;
    if (filterResourceId && b.resource_id !== filterResourceId) return false;
    if (filterDateFrom && b.start_time < new Date(filterDateFrom).toISOString())
      return false;
    if (filterDateTo && b.end_time > new Date(filterDateTo + "T23:59:59").toISOString())
      return false;
    return true;
  });

  // Build a resource name lookup
  const resourceMap = new Map(resources.map((r) => [r.id, r]));

  const inputClass =
    "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/20 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50 dark:placeholder:text-zinc-500";

  if (!workspaceId) {
    return (
      <AnimatedPage>
        <div className="space-y-8">
          <PageHeader
            title="Bookings"
            description="Please select or create a workspace first."
          />
        </div>
      </AnimatedPage>
    );
  }

  return (
    <AnimatedPage>
      <div className="space-y-8">
        {/* Header */}
        <PageHeader
          title="Bookings"
          description="Manage resources and reservations"
          actions={
            <>
              {isAdmin && (
                <Button
                  variant="outline"
                  onClick={() => setShowResourceForm((v) => !v)}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Resource
                </Button>
              )}
              <Button onClick={() => setShowBookingForm((v) => !v)}>
                <CalendarRange className="mr-2 h-4 w-4" />
                Book Resource
              </Button>
            </>
          }
        />

        {/* Add Resource Form (admin only) */}
        {showResourceForm && isAdmin && (
          <Card>
            <CardHeader>
              <CardTitle>Add New Resource</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddResource} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Name
                    </label>
                    <input
                      type="text"
                      value={newResourceName}
                      onChange={(e) => setNewResourceName(e.target.value)}
                      placeholder="Conference Room A"
                      className={inputClass}
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Type
                    </label>
                    <Select
                      value={newResourceType}
                      onValueChange={(v) =>
                        setNewResourceType(
                          v as "room" | "equipment" | "person" | "slot"
                        )
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="room">Room</SelectItem>
                        <SelectItem value="equipment">Equipment</SelectItem>
                        <SelectItem value="person">Person</SelectItem>
                        <SelectItem value="slot">Slot</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Description
                  </label>
                  <textarea
                    value={newResourceDescription}
                    onChange={(e) => setNewResourceDescription(e.target.value)}
                    rows={2}
                    placeholder="Optional description..."
                    className={inputClass}
                  />
                </div>
                <div className="flex items-center gap-3">
                  <Button type="submit" disabled={addingResource}>
                    {addingResource ? "Adding..." : "Add Resource"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowResourceForm(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Booking Form */}
        {showBookingForm && (
          <BookingForm
            resources={resources}
            onSubmit={handleBookResource}
            onCancel={() => setShowBookingForm(false)}
          />
        )}

        {/* Resources Section */}
        <section>
          <h2 className="mb-4 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
            Resources
          </h2>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
            </div>
          ) : resources.length === 0 ? (
            <EmptyState
              icon={<Building2 className="h-6 w-6" />}
              title="No resources yet"
              description={isAdmin ? "Add a resource to get started." : "Ask an admin to add resources."}
              actionLabel={isAdmin ? "Add Resource" : undefined}
              onAction={isAdmin ? () => setShowResourceForm(true) : undefined}
            />
          ) : (
            <AnimatedList>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {resources.map((resource) => (
                  <AnimatedItem key={resource.id}>
                    <Card className="h-full">
                      <CardContent className="flex items-start gap-3 p-4">
                        <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-50 dark:bg-zinc-800">
                          {TYPE_ICONS[resource.type] ?? (
                            <Building2 className="h-5 w-5 text-zinc-400" />
                          )}
                        </span>
                        <div className="min-w-0 flex-1">
                          <h3 className="truncate font-medium text-zinc-900 dark:text-zinc-50">
                            {resource.name}
                          </h3>
                          <span className="inline-block rounded bg-zinc-100 px-1.5 py-0.5 text-xs capitalize text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                            {resource.type}
                          </span>
                          {resource.description && (
                            <p className="mt-1 line-clamp-2 text-xs text-zinc-500 dark:text-zinc-400">
                              {resource.description}
                            </p>
                          )}
                        </div>
                        {isAdmin && (
                          <button
                            onClick={() => handleDeleteResource(resource.id)}
                            className="shrink-0 rounded-md p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
                            title="Delete resource"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </CardContent>
                    </Card>
                  </AnimatedItem>
                ))}
              </div>
            </AnimatedList>
          )}
        </section>

        {/* Bookings Section */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
              Bookings
            </h2>
          </div>

          {/* Filters */}
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Resource
              </label>
              <Select
                value={filterResourceId || "__all__"}
                onValueChange={(v) => setFilterResourceId(v === "__all__" ? "" : v)}
              >
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All resources</SelectItem>
                  {resources.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                From
              </label>
              <input
                type="date"
                value={filterDateFrom}
                onChange={(e) => setFilterDateFrom(e.target.value)}
                className={inputClass + " w-40"}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                To
              </label>
              <input
                type="date"
                value={filterDateTo}
                onChange={(e) => setFilterDateTo(e.target.value)}
                className={inputClass + " w-40"}
              />
            </div>
            {(filterResourceId || filterDateFrom || filterDateTo) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFilterResourceId("");
                  setFilterDateFrom("");
                  setFilterDateTo("");
                }}
              >
                <X className="mr-1 h-3.5 w-3.5" />
                Clear
              </Button>
            )}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
            </div>
          ) : filteredBookings.length === 0 ? (
            <EmptyState
              icon={<Ticket className="h-6 w-6" />}
              title="No bookings found"
              description="Book a resource to get started."
              actionLabel="Book Resource"
              onAction={() => setShowBookingForm(true)}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                    <th className="pb-3 pr-4">Resource</th>
                    <th className="pb-3 pr-4">Start</th>
                    <th className="pb-3 pr-4">End</th>
                    <th className="pb-3 pr-4">Status</th>
                    <th className="pb-3 pr-4">Notes</th>
                    <th className="pb-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {filteredBookings.map((booking) => {
                    const resource = resourceMap.get(booking.resource_id);
                    const isOwn = booking.booked_by === userId;
                    return (
                      <tr
                        key={booking.id}
                        className="text-zinc-700 dark:text-zinc-300"
                      >
                        <td className="py-3 pr-4 font-medium text-zinc-900 dark:text-zinc-50">
                          {resource?.name ?? "Unknown"}
                        </td>
                        <td className="py-3 pr-4 whitespace-nowrap">
                          {format(parseISO(booking.start_time), "MMM d, yyyy h:mm a")}
                        </td>
                        <td className="py-3 pr-4 whitespace-nowrap">
                          {format(parseISO(booking.end_time), "MMM d, yyyy h:mm a")}
                        </td>
                        <td className="py-3 pr-4">
                          <span
                            className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                              STATUS_COLORS[booking.status] ?? ""
                            }`}
                          >
                            {booking.status}
                          </span>
                        </td>
                        <td className="py-3 pr-4 max-w-[200px] truncate text-zinc-500 dark:text-zinc-400">
                          {booking.notes || "-"}
                        </td>
                        <td className="py-3 text-right">
                          {isOwn && booking.status !== "cancelled" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCancelBooking(booking.id)}
                              className="text-red-500 hover:text-red-600"
                            >
                              Cancel
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </AnimatedPage>
  );
}
