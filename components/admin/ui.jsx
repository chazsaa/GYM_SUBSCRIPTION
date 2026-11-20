import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  TextInput,
  Modal,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  useWindowDimensions,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ADMIN, TONES } from '../../theme/adminTheme';

// ---------------------------------------------------------------------------
// Building blocks for every Admin screen. Nothing here is used by the Member side.
// ---------------------------------------------------------------------------

// Wide screens (computer browser, tablet) get a sidebar and real tables.
// Phones get a top bar with a menu, and each table row becomes a card.
export const WIDE_BREAKPOINT = 1000;
export const useIsWide = () => useWindowDimensions().width >= WIDE_BREAKPOINT;

// Waits until the admin stops typing before a search runs.
export const useDebounced = (value, delay = 350) => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
};

// ---- page ------------------------------------------------------------------
export function Page({ title, subtitle, actions, children }) {
  const wide = useIsWide();
  return (
    <ScrollView
      style={styles.pageScroll}
      contentContainerStyle={[styles.pageContent, wide && styles.pageContentWide]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.pageInner}>
        <View style={[styles.pageHeader, wide && styles.pageHeaderWide]}>
          <View style={styles.pageHeaderText}>
            <Text style={styles.pageTitle} accessibilityRole="header">
              {title}
            </Text>
            {!!subtitle && <Text style={styles.pageSubtitle}>{subtitle}</Text>}
          </View>
          {!!actions && <View style={styles.pageActions}>{actions}</View>}
        </View>
        {children}
      </View>
    </ScrollView>
  );
}

export function Card({ title, subtitle, right, children, style, flush }) {
  return (
    <View style={[styles.card, style]}>
      {(!!title || !!right) && (
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderText}>
            {!!title && <Text style={styles.cardTitle}>{title}</Text>}
            {!!subtitle && <Text style={styles.cardSubtitle}>{subtitle}</Text>}
          </View>
          {!!right && <View>{right}</View>}
        </View>
      )}
      <View style={flush ? null : styles.cardBody}>{children}</View>
    </View>
  );
}

// A row of cards that wraps on small screens.
export function Grid({ children, min = 220 }) {
  return (
    <View style={styles.grid}>
      {React.Children.toArray(children).map((child, index) => (
        <View key={index} style={[styles.gridItem, { minWidth: min }]}>
          {child}
        </View>
      ))}
    </View>
  );
}

export function StatCard({ label, value, hint, icon, tone = 'brand', onPress }) {
  const colors = TONES[tone];
  const body = (
    <View style={styles.stat}>
      <View style={[styles.statIcon, { backgroundColor: colors.bg }]}>
        <MaterialCommunityIcons name={icon} size={22} color={colors.fg} />
      </View>
      <View style={styles.statText}>
        <Text style={styles.statLabel}>{label}</Text>
        <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
          {value}
        </Text>
        {!!hint && <Text style={styles.statHint}>{hint}</Text>}
      </View>
    </View>
  );
  if (!onPress) return <View style={[styles.card, styles.statCard]}>{body}</View>;
  return (
    <Pressable
      onPress={onPress}
      style={({ hovered }) => [styles.card, styles.statCard, hovered && styles.hover]}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
    >
      {body}
    </Pressable>
  );
}

export function Pill({ label, tone = 'neutral' }) {
  const colors = TONES[tone] ?? TONES.neutral;
  return (
    <View style={[styles.pill, { backgroundColor: colors.bg }]}>
      <Text style={[styles.pillText, { color: colors.fg }]}>{label}</Text>
    </View>
  );
}

// ---- buttons and inputs ------------------------------------------------------
export function Btn({ label, onPress, kind = 'primary', icon, disabled, loading, small, style }) {
  const isPrimary = kind === 'primary';
  const isDanger = kind === 'danger';
  const textColor = isPrimary ? ADMIN.onBrand : isDanger ? TONES.danger.fg : ADMIN.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!(disabled || loading) }}
      style={({ hovered, pressed }) => [
        styles.btn,
        small && styles.btnSmall,
        isPrimary && styles.btnPrimary,
        kind === 'secondary' && styles.btnSecondary,
        isDanger && styles.btnDanger,
        kind === 'ghost' && styles.btnGhost,
        (hovered || pressed) && !disabled && styles.btnActive,
        (disabled || loading) && styles.btnDisabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={textColor} />
      ) : (
        !!icon && <MaterialCommunityIcons name={icon} size={small ? 16 : 18} color={textColor} />
      )}
      <Text style={[styles.btnText, small && styles.btnTextSmall, { color: textColor }]}>{label}</Text>
    </Pressable>
  );
}

export function SearchInput({ value, onChangeText, placeholder = 'Search' }) {
  return (
    <View style={styles.search}>
      <MaterialCommunityIcons name="magnify" size={20} color={ADMIN.textMuted} />
      <TextInput
        style={styles.searchInput}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={ADMIN.textMuted}
        autoCapitalize="none"
        autoCorrect={false}
        accessibilityLabel={placeholder}
      />
      {!!value && (
        <Pressable onPress={() => onChangeText('')} accessibilityRole="button" accessibilityLabel="Clear search" hitSlop={8}>
          <MaterialCommunityIcons name="close-circle" size={18} color={ADMIN.textMuted} />
        </Pressable>
      )}
    </View>
  );
}

// Labelled text field for forms.
export function Field({ label, hint, error, multiline, style, ...inputProps }) {
  return (
    <View style={[styles.field, style]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        {...inputProps}
        multiline={multiline}
        accessibilityLabel={label}
        placeholderTextColor={ADMIN.textMuted}
        style={[styles.input, multiline && styles.inputMultiline, !!error && styles.inputError]}
      />
      {!!error && <Text style={styles.fieldError}>{error}</Text>}
      {!error && !!hint && <Text style={styles.fieldHint}>{hint}</Text>}
    </View>
  );
}

// A row of filter buttons, e.g. All / Active / Expired.
export function Chips({ options, value, onChange }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
      {options.map((option) => {
        const selected = option.key === value;
        return (
          <Pressable
            key={option.key}
            onPress={() => onChange(option.key)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            style={({ hovered }) => [styles.chip, selected && styles.chipOn, hovered && !selected && styles.hover]}
          >
            <Text style={[styles.chipText, selected && styles.chipTextOn]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

// Big tabs at the top of a page (e.g. Memberships | Plans).
export function Tabs({ options, value, onChange }) {
  return (
    <View style={styles.tabs} accessibilityRole="tablist">
      {options.map((option) => {
        const selected = option.key === value;
        return (
          <Pressable
            key={option.key}
            onPress={() => onChange(option.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            style={[styles.tab, selected && styles.tabOn]}
          >
            <Text style={[styles.tabText, selected && styles.tabTextOn]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ---- states -------------------------------------------------------------------
export function Banner({ tone = 'info', text, onClose }) {
  if (!text) return null;
  const colors = TONES[tone];
  return (
    <View
      style={[styles.banner, { backgroundColor: colors.bg }]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <MaterialCommunityIcons
        name={tone === 'success' ? 'check-circle-outline' : 'alert-circle-outline'}
        size={20}
        color={colors.fg}
      />
      <Text style={[styles.bannerText, { color: colors.fg }]}>{text}</Text>
      {!!onClose && (
        <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Dismiss" hitSlop={8}>
          <MaterialCommunityIcons name="close" size={18} color={colors.fg} />
        </Pressable>
      )}
    </View>
  );
}

export function Loading({ label = 'Loading…' }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={ADMIN.brand} />
      <Text style={styles.centerText}>{label}</Text>
    </View>
  );
}

export function EmptyState({ icon = 'tray-remove', title, text }) {
  return (
    <View style={styles.center}>
      <MaterialCommunityIcons name={icon} size={34} color={ADMIN.textMuted} />
      <Text style={styles.emptyTitle}>{title}</Text>
      {!!text && <Text style={styles.centerText}>{text}</Text>}
    </View>
  );
}

// ---- table / cards ------------------------------------------------------------
// The clickable layer of a table row. It sits BEHIND the row's content instead of
// wrapping it, so a row can hold its own buttons (Extend, End...) without putting
// a button inside a button, which browsers do not allow.
function RowHit({ onPress, round }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Open details"
      style={({ hovered }) => [styles.rowHit, round && styles.rowHitRound, hovered && styles.hover]}
    />
  );
}

// columns: [{ key, title, flex, align, render(row), primary, badge, actions, hideOnCard }]
//   Wide screen: a normal table.
//   Phone: each row is a card. `primary` is the card title, `badge` sits at its
//   right, `actions` are the buttons at the bottom, and the rest are label/value lines.
export function DataTable({ columns, rows, keyOf, onRowPress, loading, emptyTitle, emptyText }) {
  const wide = useIsWide();

  if (loading && rows.length === 0) return <Loading />;
  if (rows.length === 0) return <EmptyState title={emptyTitle ?? 'Nothing to show'} text={emptyText} />;

  const cell = (column, row) => {
    const out = column.render ? column.render(row) : row[column.key];
    if (typeof out === 'string' || typeof out === 'number') {
      return (
        <Text style={styles.tdText} numberOfLines={2}>
          {out === '' ? '-' : out}
        </Text>
      );
    }
    return out;
  };

  if (wide) {
    return (
      <View style={[styles.table, loading && styles.dim]}>
        <View style={styles.thead}>
          {columns.map((column) => (
            <Text
              key={column.key}
              style={[styles.th, { flex: column.flex ?? 1 }, column.align === 'right' && styles.right]}
            >
              {column.title}
            </Text>
          ))}
        </View>
        {rows.map((row) => (
          <View key={keyOf(row)} style={styles.tr}>
            {!!onRowPress && <RowHit onPress={() => onRowPress(row)} />}
            {columns.map((column) => (
              <View
                key={column.key}
                style={[
                  styles.td,
                  { flex: column.flex ?? 1 },
                  column.align === 'right' && styles.tdRight,
                  column.actions ? styles.passThrough : styles.inert,
                ]}
              >
                {cell(column, row)}
              </View>
            ))}
          </View>
        ))}
      </View>
    );
  }

  const primary = columns.find((c) => c.primary) ?? columns[0];
  const badge = columns.find((c) => c.badge);
  const actions = columns.find((c) => c.actions);
  const lines = columns.filter((c) => c !== primary && c !== badge && c !== actions && !c.hideOnCard);

  return (
    <View style={loading ? styles.dim : null}>
      {rows.map((row) => (
        <View key={keyOf(row)} style={[styles.card, styles.rowCard]}>
          {!!onRowPress && <RowHit onPress={() => onRowPress(row)} round />}
          <View style={styles.inert}>
            <View style={styles.rowCardTop}>
              <View style={styles.flex1}>{cell(primary, row)}</View>
              {!!badge && <View>{cell(badge, row)}</View>}
            </View>
            {lines.map((column) => (
              <View key={column.key} style={styles.rowCardLine}>
                <Text style={styles.rowCardLabel}>{column.title}</Text>
                <View style={styles.rowCardValue}>{cell(column, row)}</View>
              </View>
            ))}
          </View>
          {!!actions && <View style={styles.rowCardActions}>{cell(actions, row)}</View>}
        </View>
      ))}
    </View>
  );
}

export function Pager({ total, offset, limit, onChange }) {
  if (!total || total <= limit) return null;
  const from = offset + 1;
  const to = Math.min(offset + limit, total);
  return (
    <View style={styles.pager}>
      <Text style={styles.pagerText}>
        {from}–{to} of {total}
      </Text>
      <View style={styles.pagerButtons}>
        <Btn label="Previous" kind="secondary" small disabled={offset === 0} onPress={() => onChange(Math.max(0, offset - limit))} />
        <Btn label="Next" kind="secondary" small disabled={to >= total} onPress={() => onChange(offset + limit)} />
      </View>
    </View>
  );
}

// ---- dialogs ------------------------------------------------------------------
export function Dialog({ visible, title, onClose, children, footer }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close dialog" />
        <View style={styles.dialog} accessibilityViewIsModal>
          <View style={styles.dialogHeader}>
            <Text style={styles.dialogTitle} accessibilityRole="header">
              {title}
            </Text>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" hitSlop={8}>
              <MaterialCommunityIcons name="close" size={22} color={ADMIN.textMuted} />
            </Pressable>
          </View>
          <ScrollView style={styles.dialogBody} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
          {!!footer && <View style={styles.dialogFooter}>{footer}</View>}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function ConfirmModal({
  visible,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger,
  busy,
  children,
  onConfirm,
  onCancel,
}) {
  return (
    <Dialog
      visible={visible}
      title={title}
      onClose={onCancel}
      footer={
        <>
          <Btn label={cancelLabel} kind="secondary" onPress={onCancel} disabled={busy} />
          <Btn label={confirmLabel} kind={danger ? 'danger' : 'primary'} onPress={onConfirm} loading={busy} />
        </>
      }
    >
      <Text style={styles.dialogText}>{message}</Text>
      {children}
    </Dialog>
  );
}

// Label / value rows for detail views.
export function DetailRow({ label, children }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <View style={styles.detailValue}>
        {typeof children === 'string' || typeof children === 'number' ? (
          <Text selectable style={styles.detailText}>
            {children === '' ? '-' : children}
          </Text>
        ) : (
          children
        )}
      </View>
    </View>
  );
}

// ---- charts (plain Views, no extra library) ----------------------------------------
// data: [{ label, value }]. Tap a bar to read its exact value.
export function BarChart({ data, height = 170, formatValue, formatLabel }) {
  const [picked, setPicked] = useState(null);
  const max = Math.max(1, ...data.map((d) => d.value));
  const step = Math.max(1, Math.ceil(data.length / 8));
  const index = picked !== null && picked < data.length ? picked : data.length - 1;
  // Never empty, so drawing a chart with no data cannot crash.
  const current = data[index] ?? { label: '', value: 0 };
  const labelOf = (d) => (formatLabel ? formatLabel(d.label) : d.label);
  const valueOf = (v) => (formatValue ? formatValue(v) : String(v));

  if (data.length === 0) return <EmptyState title="No data yet" />;

  return (
    <View>
      <Text style={styles.chartCaption} accessibilityLiveRegion="polite">
        {labelOf(current)} · <Text style={styles.chartCaptionStrong}>{valueOf(current.value)}</Text>
      </Text>
      <View style={[styles.chart, { height }]}>
        {data.map((d, i) => (
          <Pressable
            key={`${d.label}-${i}`}
            style={styles.barSlot}
            onPress={() => setPicked(i)}
            accessibilityRole="button"
            accessibilityLabel={`${labelOf(d)}: ${valueOf(d.value)}`}
          >
            <View
              style={[
                styles.bar,
                { height: d.value > 0 ? Math.max(4, (d.value / max) * (height - 4)) : 2 },
                i === index ? styles.barOn : null,
                d.value === 0 && styles.barEmpty,
              ]}
            />
          </Pressable>
        ))}
      </View>
      <View style={styles.axis}>
        {data.map((d, i) => (
          <View key={`${d.label}-${i}`} style={styles.axisSlot}>
            {i % step === 0 && (
              <Text style={styles.axisText} numberOfLines={1}>
                {labelOf(d)}
              </Text>
            )}
          </View>
        ))}
      </View>
    </View>
  );
}

// One horizontal bar with a label, e.g. revenue per plan.
export function BarRow({ label, value, max, valueLabel, tone = 'brand' }) {
  const percent = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return (
    <View style={styles.barRow}>
      <View style={styles.barRowTop}>
        <Text style={styles.barRowLabel} numberOfLines={1}>
          {label}
        </Text>
        <Text style={styles.barRowValue}>{valueLabel}</Text>
      </View>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${percent}%`, backgroundColor: TONES[tone].bar }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex1: { flex: 1 },
  right: { textAlign: 'right' },
  hover: { backgroundColor: ADMIN.surfaceAlt },
  dim: { opacity: 0.55 },

  // page
  pageScroll: { flex: 1, backgroundColor: ADMIN.bg },
  pageContent: { padding: 16, paddingBottom: 48 },
  pageContentWide: { padding: 32, paddingBottom: 64 },
  pageInner: { width: '100%', maxWidth: 1240, alignSelf: 'center' },
  pageHeader: { marginBottom: 20, gap: 12 },
  pageHeaderWide: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  pageHeaderText: { flexShrink: 1 },
  pageTitle: { color: ADMIN.text, fontSize: 26, fontWeight: '800' },
  pageSubtitle: { color: ADMIN.textMuted, fontSize: 14, marginTop: 4, lineHeight: 20 },
  pageActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

  // card
  card: {
    backgroundColor: ADMIN.surface,
    borderWidth: 1,
    borderColor: ADMIN.border,
    borderRadius: 12,
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 4,
  },
  cardHeaderText: { flexShrink: 1 },
  cardTitle: { color: ADMIN.text, fontSize: 16, fontWeight: '700' },
  cardSubtitle: { color: ADMIN.textMuted, fontSize: 13, marginTop: 2 },
  cardBody: { padding: 18 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -8 },
  gridItem: { flexGrow: 1, flexBasis: 0, paddingHorizontal: 8 },

  // stat
  statCard: { marginBottom: 16 },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 },
  statIcon: { width: 44, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  statText: { flexShrink: 1, flex: 1 },
  statLabel: { color: ADMIN.textMuted, fontSize: 13, fontWeight: '600' },
  statValue: { color: ADMIN.text, fontSize: 24, fontWeight: '800', marginTop: 2 },
  statHint: { color: ADMIN.textMuted, fontSize: 12, marginTop: 2 },

  pill: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  pillText: { fontSize: 12, fontWeight: '700' },

  // buttons
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 42,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  btnSmall: { minHeight: 34, paddingHorizontal: 12 },
  btnPrimary: { backgroundColor: ADMIN.brand },
  btnSecondary: { backgroundColor: ADMIN.surface, borderColor: ADMIN.border },
  btnDanger: { backgroundColor: TONES.danger.bg, borderColor: '#FCA5A5' },
  btnGhost: { backgroundColor: 'transparent' },
  btnActive: { opacity: 0.85 },
  btnDisabled: { opacity: 0.5 },
  btnText: { fontSize: 14, fontWeight: '700' },
  btnTextSmall: { fontSize: 13 },

  // inputs
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: ADMIN.surface,
    borderWidth: 1,
    borderColor: ADMIN.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    minHeight: 44,
  },
  searchInput: { flex: 1, color: ADMIN.text, fontSize: 14, paddingVertical: 10, outlineStyle: 'none' },
  field: { marginBottom: 14 },
  fieldLabel: { color: ADMIN.text, fontSize: 13, fontWeight: '700', marginBottom: 6 },
  input: {
    backgroundColor: ADMIN.surface,
    borderWidth: 1,
    borderColor: '#CBD2DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 44,
    color: ADMIN.text,
    fontSize: 14,
  },
  inputMultiline: { minHeight: 96, textAlignVertical: 'top' },
  inputError: { borderColor: TONES.danger.bar },
  fieldError: { color: TONES.danger.fg, fontSize: 12, marginTop: 4 },
  fieldHint: { color: ADMIN.textMuted, fontSize: 12, marginTop: 4 },

  chips: { gap: 8, paddingVertical: 2 },
  chip: {
    paddingHorizontal: 14,
    minHeight: 36,
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: ADMIN.surface,
    borderWidth: 1,
    borderColor: ADMIN.border,
  },
  chipOn: { backgroundColor: ADMIN.brand, borderColor: ADMIN.brand },
  chipText: { color: ADMIN.text, fontSize: 13, fontWeight: '600' },
  chipTextOn: { color: ADMIN.onBrand },

  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: ADMIN.border, marginBottom: 18 },
  tab: { paddingHorizontal: 18, paddingVertical: 12, borderBottomWidth: 3, borderBottomColor: 'transparent', marginBottom: -1 },
  tabOn: { borderBottomColor: ADMIN.brand },
  tabText: { color: ADMIN.textMuted, fontSize: 15, fontWeight: '600' },
  tabTextOn: { color: ADMIN.brand, fontWeight: '800' },

  // states
  banner: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 8, marginBottom: 16 },
  bannerText: { flex: 1, fontSize: 14, lineHeight: 20, fontWeight: '600' },
  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: 36, paddingHorizontal: 20, gap: 8 },
  centerText: { color: ADMIN.textMuted, fontSize: 14, textAlign: 'center' },
  emptyTitle: { color: ADMIN.text, fontSize: 16, fontWeight: '700', textAlign: 'center' },

  // table
  table: {
    backgroundColor: ADMIN.surface,
    borderWidth: 1,
    borderColor: ADMIN.border,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
  },
  thead: {
    flexDirection: 'row',
    backgroundColor: ADMIN.surfaceAlt,
    borderBottomWidth: 1,
    borderBottomColor: ADMIN.border,
    paddingHorizontal: 16,
    paddingVertical: 11,
    gap: 12,
  },
  th: { color: ADMIN.textMuted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  tr: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: ADMIN.border,
    minHeight: 56,
  },
  td: { justifyContent: 'center' },
  tdRight: { alignItems: 'flex-end' },
  tdText: { color: ADMIN.text, fontSize: 14 },
  rowHit: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  rowHitRound: { borderRadius: 12 },
  // Row content lets clicks fall through to the layer behind it; only the
  // action buttons (passThrough) catch their own clicks.
  inert: { pointerEvents: 'none' },
  passThrough: { pointerEvents: 'box-none' },

  rowCard: { padding: 14 },
  rowCardTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 6 },
  rowCardLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4, gap: 12 },
  rowCardLabel: { color: ADMIN.textMuted, fontSize: 13 },
  rowCardValue: { flexShrink: 1, alignItems: 'flex-end' },
  rowCardActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },

  pager: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 12 },
  pagerText: { color: ADMIN.textMuted, fontSize: 13 },
  pagerButtons: { flexDirection: 'row', gap: 8 },

  // dialog
  overlay: { flex: 1, backgroundColor: 'rgba(17,24,39,0.55)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  dialog: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '88%',
    backgroundColor: ADMIN.surface,
    borderRadius: 14,
    overflow: 'hidden',
  },
  dialogHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: ADMIN.border,
  },
  dialogTitle: { flex: 1, color: ADMIN.text, fontSize: 17, fontWeight: '800' },
  dialogBody: { paddingHorizontal: 20, paddingVertical: 16, flexGrow: 0 },
  dialogText: { color: ADMIN.text, fontSize: 14, lineHeight: 21 },
  dialogFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: ADMIN.border,
    backgroundColor: ADMIN.surfaceAlt,
  },

  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, gap: 16, borderBottomWidth: 1, borderBottomColor: ADMIN.border },
  detailLabel: { color: ADMIN.textMuted, fontSize: 13 },
  detailValue: { flexShrink: 1, alignItems: 'flex-end' },
  detailText: { color: ADMIN.text, fontSize: 14, fontWeight: '600', textAlign: 'right' },

  // charts
  chartCaption: { color: ADMIN.textMuted, fontSize: 13, marginBottom: 10 },
  chartCaptionStrong: { color: ADMIN.text, fontWeight: '800' },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, borderBottomWidth: 1, borderBottomColor: ADMIN.border },
  barSlot: { flex: 1, height: '100%', justifyContent: 'flex-end', minHeight: 44 },
  bar: { width: '100%', backgroundColor: '#C98B8B', borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  barOn: { backgroundColor: ADMIN.brand },
  barEmpty: { backgroundColor: ADMIN.border },
  axis: { flexDirection: 'row', gap: 4, marginTop: 6 },
  axisSlot: { flex: 1, overflow: 'visible' },
  axisText: { color: ADMIN.textMuted, fontSize: 11, width: 60 },
  barRow: { marginBottom: 14 },
  barRowTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginBottom: 6 },
  barRowLabel: { flex: 1, color: ADMIN.text, fontSize: 14, fontWeight: '600' },
  barRowValue: { color: ADMIN.textMuted, fontSize: 13 },
  barTrack: { height: 8, borderRadius: 4, backgroundColor: ADMIN.border, overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 4 },
});
