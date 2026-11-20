import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { emptyWishForm, validateWish, type FieldErrors, type WishFormValues } from '@/lib/validation';
import { PRIORITY_LABEL } from '@/lib/format';
import type { Wish, WishInput } from '@/types';

interface Props {
  open: boolean;
  initial?: Wish | null;
  onClose: () => void;
  onSubmit: (input: WishInput) => Promise<void>;
}

function toForm(wish: Wish | null | undefined): WishFormValues {
  if (!wish) return emptyWishForm;
  return {
    name: wish.name,
    description: wish.description ?? '',
    product_url: wish.product_url ?? '',
    price: wish.approx_price_cents === null ? '' : String(wish.approx_price_cents / 100),
    priority: wish.priority,
    is_surprise: wish.is_surprise,
    category: wish.category ?? '',
    notes: wish.notes ?? '',
  };
}

const fieldClass = 'input';

/** Alta y edición de un regalo. Se usa el mismo formulario para ambos casos. */
export function WishFormModal({ open, initial, onClose, onSubmit }: Props) {
  const [values, setValues] = useState<WishFormValues>(emptyWishForm);
  const [errors, setErrors] = useState<FieldErrors<WishFormValues>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const isEdit = Boolean(initial);

  useEffect(() => {
    if (open) {
      setValues(toForm(initial));
      setErrors({});
      setSubmitError(null);
    }
  }, [open, initial]);

  const set = <K extends keyof WishFormValues>(key: K, value: WishFormValues[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    const { errors: found, input } = validateWish(values);
    setErrors(found);
    if (!input) return;

    setSaving(true);
    setSubmitError(null);
    try {
      await onSubmit(input);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'No se pudo guardar.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={saving ? () => {} : onClose}
      title={isEdit ? 'Editar deseo' : 'Añadir deseo'}
      footer={
        <>
          <button type="button" className="btn-ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button type="submit" form="wish-form" className="btn-primary" disabled={saving}>
            {saving ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Añadir a mi carta'}
          </button>
        </>
      }
    >
      <form id="wish-form" onSubmit={handleSubmit} noValidate className="space-y-4">
        <div>
          <label className="label" htmlFor="wish-name">Nombre del regalo *</label>
          <input
            id="wish-name"
            className={fieldClass}
            value={values.name}
            maxLength={120}
            autoFocus
            onChange={(e) => set('name', e.target.value)}
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? 'wish-name-error' : undefined}
          />
          {errors.name && <p id="wish-name-error" className="mt-1 text-sm text-red-300">{errors.name}</p>}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="wish-price">Precio aproximado (€)</label>
            <input
              id="wish-price"
              inputMode="decimal"
              className={fieldClass}
              value={values.price}
              placeholder="35"
              onChange={(e) => set('price', e.target.value)}
              aria-invalid={Boolean(errors.price)}
            />
            {errors.price && <p className="mt-1 text-sm text-red-300">{errors.price}</p>}
          </div>
          <div>
            <label className="label" htmlFor="wish-priority">Prioridad</label>
            <select
              id="wish-priority"
              className={fieldClass}
              value={values.priority}
              onChange={(e) => set('priority', Number(e.target.value) as 1 | 2 | 3)}
            >
              {([3, 2, 1] as const).map((p) => (
                <option key={p} value={p} className="bg-pine-deep">
                  {'⭐'.repeat(p)} {PRIORITY_LABEL[p]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="label" htmlFor="wish-url">Enlace del producto</label>
          <input
            id="wish-url"
            type="url"
            className={fieldClass}
            value={values.product_url}
            placeholder="https://…"
            onChange={(e) => set('product_url', e.target.value)}
            aria-invalid={Boolean(errors.product_url)}
          />
          {errors.product_url && <p className="mt-1 text-sm text-red-300">{errors.product_url}</p>}
        </div>

        <div>
          <label className="label" htmlFor="wish-description">Descripción</label>
          <textarea
            id="wish-description"
            rows={2}
            className={fieldClass}
            value={values.description}
            onChange={(e) => set('description', e.target.value)}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="wish-category">Categoría</label>
            <input
              id="wish-category"
              className={fieldClass}
              value={values.category}
              placeholder="Deporte, Moda…"
              onChange={(e) => set('category', e.target.value)}
            />
          </div>
          <label className="flex cursor-pointer items-center gap-3 self-end rounded-xl border border-white/15 bg-black/20 px-3.5 py-2.5">
            <input
              type="checkbox"
              className="h-4 w-4 accent-gold"
              checked={values.is_surprise}
              onChange={(e) => set('is_surprise', e.target.checked)}
            />
            <span className="text-sm">🎁 Sorpresa: acepto ideas parecidas</span>
          </label>
        </div>

        <div>
          <label className="label" htmlFor="wish-notes">Notas privadas para quien regale</label>
          <textarea
            id="wish-notes"
            rows={2}
            className={fieldClass}
            value={values.notes}
            onChange={(e) => set('notes', e.target.value)}
          />
        </div>

        {submitError && (
          <p role="alert" className="rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-200">
            {submitError}
          </p>
        )}
      </form>
    </Modal>
  );
}
