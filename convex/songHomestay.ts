import { ConvexError, v } from 'convex/values';
import { mutation, query } from './_generated/server';
import type { MutationCtx } from './_generated/server';
import type { Id } from './_generated/dataModel';
import { enumerateNights, generateConfirmationCode } from '../shared/pricing';
import { markPropertyDirtyInline } from './channel/ari';
import { requireMutationPropertyCapability, requirePropertyCapability } from './staff';

const activeBookingStatuses = new Set(['hold', 'confirmed', 'checked_in', 'external', 'blocked']);

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function normalizePhone(value: string): string {
  return value.replace(/\D/g, '');
}

function assertDateRange(checkIn: string, checkOut: string): string[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(checkIn) || !/^\d{4}-\d{2}-\d{2}$/.test(checkOut)) {
    throw new ConvexError({ code: 'INVALID_DATES', message: 'Ngày nhận/trả phòng không hợp lệ.' });
  }
  const nights = enumerateNights(checkIn, checkOut);
  if (nights.length < 1) {
    throw new ConvexError({ code: 'INVALID_DATE_RANGE', message: 'Ngày trả phòng phải sau ngày nhận phòng.' });
  }
  return nights;
}

async function requireRead(ctx: Parameters<typeof requirePropertyCapability>[0], propertyId: Id<'properties'>) {
  if (process.env.DEMO_MODE !== 'true') {
    await requirePropertyCapability(ctx, propertyId, 'booking.read');
  }
}

async function requireWrite(ctx: MutationCtx, propertyId: Id<'properties'>, action: string) {
  if (process.env.DEMO_MODE !== 'true') {
    await requireMutationPropertyCapability(ctx, propertyId, 'booking.write', action);
  }
}

async function assertUnitAvailable(
  ctx: MutationCtx,
  unitId: Id<'units'>,
  nights: string[],
): Promise<void> {
  for (const date of nights) {
    const occupied = await ctx.db
      .query('unitNights')
      .withIndex('by_unit_date', (q) => q.eq('unitId', unitId).eq('date', date))
      .first();
    if (occupied) {
      throw new ConvexError({
        code: 'DATES_UNAVAILABLE',
        message: `Căn đã có booking vào ngày ${date}. Vui lòng chọn ngày hoặc căn khác.`,
      });
    }
  }
}

export const managementCatalog = query({
  args: { propertyId: v.id('properties') },
  handler: async (ctx, args) => {
    await requireRead(ctx, args.propertyId);
    const [property, units, unitTypes, addOns] = await Promise.all([
      ctx.db.get(args.propertyId),
      ctx.db.query('units').withIndex('by_property', (q) => q.eq('propertyId', args.propertyId)).collect(),
      ctx.db.query('unitTypes').withIndex('by_property', (q) => q.eq('propertyId', args.propertyId)).collect(),
      ctx.db.query('addOns').withIndex('by_property', (q) => q.eq('propertyId', args.propertyId)).collect(),
    ]);
    if (!property) throw new ConvexError('PROPERTY_NOT_FOUND');
    return {
      property: { propertyId: property._id, name: property.name, slug: property.slug, currency: property.currency },
      unitTypes: unitTypes
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((row) => ({ unitTypeId: row._id, name: row.name, maxOccupancy: row.maxOccupancy })),
      units: units
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((row) => ({
          unitId: row._id,
          unitTypeId: row.unitTypeId,
          name: row.name,
          slug: row.slug,
          status: row.status,
          sortOrder: row.sortOrder,
        })),
      addOns: addOns
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((row) => ({
          addOnId: row._id,
          name: row.name,
          priceCents: row.priceCents,
          unitLabel: row.unitLabel,
          taxable: row.taxable,
          active: row.active,
          sortOrder: row.sortOrder,
        })),
    };
  },
});

export const kpiSummary = query({
  args: { propertyId: v.id('properties'), since: v.string() },
  handler: async (ctx, args) => {
    await requireRead(ctx, args.propertyId);
    const [bookings, units] = await Promise.all([
      ctx.db
        .query('bookings')
        .withIndex('by_property_checkIn', (q) => q.eq('propertyId', args.propertyId).gte('checkIn', args.since))
        .collect(),
      ctx.db.query('units').withIndex('by_property', (q) => q.eq('propertyId', args.propertyId)).collect(),
    ]);
    const live = bookings.filter((booking) => booking.status !== 'cancelled' && booking.status !== 'expired');
    const direct = live.filter((booking) => booking.source === 'online');
    let directWithServices = 0;
    for (const booking of direct) {
      const addOn = await ctx.db
        .query('bookingAddOns')
        .withIndex('by_booking', (q) => q.eq('bookingId', booking._id))
        .first();
      if (addOn) directWithServices += 1;
    }
    const conflictResolutionMinutes: number[] = [];
    for (const booking of bookings) {
      const resolution = booking.notes.find((note) =>
        note.text.includes('Xử lý Double Booking') || note.text.includes('Đã xử lý trên OTA'),
      );
      if (resolution) conflictResolutionMinutes.push(Math.max(0, (resolution.ts - booking.createdAt) / 60_000));
    }
    const feedStates = units.flatMap((unit) => unit.icalImports);
    const lastSyncAt = feedStates.reduce((latest, feed) => Math.max(latest, feed.lastSyncedAt ?? 0), 0);
    return {
      since: args.since,
      totalBookings: live.length,
      directBookings: direct.length,
      manualBookings: live.filter((booking) => booking.source.startsWith('manual:')).length,
      otaBookings: live.filter((booking) => booking.source.startsWith('ical:')).length,
      directSharePercent: live.length > 0 ? Math.round((direct.length / live.length) * 1000) / 10 : 0,
      directWithServices,
      serviceAttachPercent: direct.length > 0 ? Math.round((directWithServices / direct.length) * 1000) / 10 : 0,
      activeConflicts: live.filter((booking) => booking.syncConflict && !booking.syncConflictAcknowledgedAt).length,
      averageResolutionMinutes: conflictResolutionMinutes.length > 0
        ? Math.round(conflictResolutionMinutes.reduce((sum, value) => sum + value, 0) / conflictResolutionMinutes.length)
        : null,
      configuredFeeds: feedStates.length,
      failedFeeds: feedStates.filter((feed) => feed.lastStatus?.startsWith('error:')).length,
      lastSyncAt: lastSyncAt || null,
    };
  },
});

export const createManualBooking = mutation({
  args: {
    propertyId: v.id('properties'),
    unitId: v.id('units'),
    checkIn: v.string(),
    checkOut: v.string(),
    guestName: v.string(),
    guestEmail: v.optional(v.string()),
    guestPhone: v.string(),
    adults: v.number(),
    children: v.number(),
    source: v.union(
      v.literal('zalo'),
      v.literal('facebook'),
      v.literal('phone'),
      v.literal('walk_in'),
      v.literal('other'),
    ),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireWrite(ctx, args.propertyId, 'song.manual_booking.create');
    const unit = await ctx.db.get(args.unitId);
    if (!unit || unit.propertyId !== args.propertyId || unit.status !== 'active') {
      throw new ConvexError({ code: 'UNIT_UNAVAILABLE', message: 'Căn không tồn tại hoặc đang ngừng kinh doanh.' });
    }
    const nights = assertDateRange(args.checkIn, args.checkOut);
    await assertUnitAvailable(ctx, unit._id, nights);
    const guestName = args.guestName.trim();
    const phone = args.guestPhone.trim();
    if (!guestName || !phone) {
      throw new ConvexError({ code: 'GUEST_REQUIRED', message: 'Vui lòng nhập tên và số điện thoại khách.' });
    }
    if (!Number.isInteger(args.adults) || args.adults < 1 || !Number.isInteger(args.children) || args.children < 0) {
      throw new ConvexError({ code: 'INVALID_OCCUPANCY', message: 'Số lượng khách không hợp lệ.' });
    }

    const normalizedEmail = normalizeEmail(args.guestEmail ?? '');
    const normalizedPhone = normalizePhone(phone);
    let guest = normalizedPhone
      ? await ctx.db
          .query('guests')
          .withIndex('by_phone', (q) => q.eq('propertyId', args.propertyId).eq('normalizedPhone', normalizedPhone))
          .first()
      : null;
    if (!guest && normalizedEmail) {
      guest = await ctx.db
        .query('guests')
        .withIndex('by_email', (q) => q.eq('propertyId', args.propertyId).eq('normalizedEmail', normalizedEmail))
        .first();
    }
    let guestId: Id<'guests'>;
    if (guest) {
      guestId = guest._id;
      await ctx.db.patch(guest._id, {
        name: guestName,
        email: args.guestEmail?.trim() ?? guest.email,
        normalizedEmail: normalizedEmail || guest.normalizedEmail,
        phone,
        normalizedPhone,
      });
    } else {
      guestId = await ctx.db.insert('guests', {
        propertyId: args.propertyId,
        name: guestName,
        email: args.guestEmail?.trim() ?? '',
        phone,
        normalizedEmail,
        normalizedPhone,
        marketingOptIn: false,
        notes: [],
      });
    }

    const now = Date.now();
    const confirmationCode = generateConfirmationCode((max) => Math.floor(Math.random() * max));
    const bookingId = await ctx.db.insert('bookings', {
      propertyId: args.propertyId,
      unitId: unit._id,
      unitTypeId: unit.unitTypeId,
      guestId,
      checkIn: args.checkIn,
      checkOut: args.checkOut,
      nights: nights.length,
      adults: args.adults,
      children: args.children,
      status: 'confirmed',
      source: `manual:${args.source}`,
      confirmationCode,
      statusHistory: [{ status: 'confirmed', ts: now }],
      notes: args.note?.trim() ? [{ ts: now, text: args.note.trim(), by: 'Admin Sóng Homestay' }] : [],
      createdAt: now,
      updatedAt: now,
      version: 0,
    });
    for (const date of nights) {
      await ctx.db.insert('unitNights', { unitId: unit._id, date, bookingId, kind: 'stay' });
    }
    await markPropertyDirtyInline(ctx, args.propertyId);
    return { bookingId, confirmationCode };
  },
});

export const createUnit = mutation({
  args: {
    propertyId: v.id('properties'),
    unitTypeId: v.id('unitTypes'),
    name: v.string(),
    slug: v.string(),
  },
  handler: async (ctx, args) => {
    await requireWrite(ctx, args.propertyId, 'song.unit.create');
    const unitType = await ctx.db.get(args.unitTypeId);
    if (!unitType || unitType.propertyId !== args.propertyId) throw new ConvexError('INVALID_UNIT_TYPE');
    const name = args.name.trim();
    const slug = args.slug.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
    if (!name || !slug) throw new ConvexError('UNIT_NAME_SLUG_REQUIRED');
    const duplicate = await ctx.db
      .query('units')
      .withIndex('by_property', (q) => q.eq('propertyId', args.propertyId))
      .collect();
    if (duplicate.some((row) => row.slug === slug)) throw new ConvexError('UNIT_SLUG_EXISTS');
    const unitId = await ctx.db.insert('units', {
      propertyId: args.propertyId,
      unitTypeId: args.unitTypeId,
      name,
      slug,
      status: 'active',
      icalExportToken: crypto.randomUUID().replaceAll('-', ''),
      icalImports: [],
      sortOrder: duplicate.length + 1,
    });
    return { unitId };
  },
});

export const updateUnit = mutation({
  args: {
    propertyId: v.id('properties'),
    unitId: v.id('units'),
    name: v.string(),
    status: v.union(v.literal('active'), v.literal('coming_soon'), v.literal('offline')),
  },
  handler: async (ctx, args) => {
    await requireWrite(ctx, args.propertyId, 'song.unit.update');
    const unit = await ctx.db.get(args.unitId);
    if (!unit || unit.propertyId !== args.propertyId) throw new ConvexError('UNIT_NOT_FOUND');
    if (!args.name.trim()) throw new ConvexError('UNIT_NAME_REQUIRED');
    if (args.status === 'offline') {
      const rows = await ctx.db.query('bookings').withIndex('by_unit_checkIn', (q) => q.eq('unitId', unit._id)).collect();
      if (rows.some((row) => activeBookingStatuses.has(row.status))) {
        throw new ConvexError({ code: 'UNIT_HAS_ACTIVE_BOOKINGS', message: 'Không thể ngừng căn đang có booking hoạt động.' });
      }
    }
    await ctx.db.patch(unit._id, { name: args.name.trim(), status: args.status });
    return { updated: true };
  },
});

export const createAddOn = mutation({
  args: {
    propertyId: v.id('properties'),
    name: v.string(),
    priceCents: v.number(),
    unitLabel: v.string(),
    taxable: v.boolean(),
  },
  handler: async (ctx, args) => {
    await requireWrite(ctx, args.propertyId, 'song.addon.create');
    if (!args.name.trim() || !args.unitLabel.trim() || !Number.isInteger(args.priceCents) || args.priceCents < 0) {
      throw new ConvexError('INVALID_ADDON');
    }
    const existing = await ctx.db
      .query('addOns')
      .withIndex('by_property', (q) => q.eq('propertyId', args.propertyId))
      .collect();
    const addOnId = await ctx.db.insert('addOns', {
      propertyId: args.propertyId,
      name: args.name.trim(),
      priceCents: args.priceCents,
      taxable: args.taxable,
      unitLabel: args.unitLabel.trim(),
      appliesTo: [],
      active: true,
      sortOrder: existing.length + 1,
    });
    return { addOnId };
  },
});

export const updateAddOn = mutation({
  args: {
    propertyId: v.id('properties'),
    addOnId: v.id('addOns'),
    name: v.string(),
    priceCents: v.number(),
    unitLabel: v.string(),
    taxable: v.boolean(),
    active: v.boolean(),
  },
  handler: async (ctx, args) => {
    await requireWrite(ctx, args.propertyId, 'song.addon.update');
    const addOn = await ctx.db.get(args.addOnId);
    if (!addOn || addOn.propertyId !== args.propertyId) throw new ConvexError('ADDON_NOT_FOUND');
    if (!args.name.trim() || !args.unitLabel.trim() || !Number.isInteger(args.priceCents) || args.priceCents < 0) {
      throw new ConvexError('INVALID_ADDON');
    }
    await ctx.db.patch(addOn._id, {
      name: args.name.trim(),
      priceCents: args.priceCents,
      unitLabel: args.unitLabel.trim(),
      taxable: args.taxable,
      active: args.active,
    });
    return { updated: true };
  },
});
