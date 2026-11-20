import type { WishInput } from '@/types';
import { eurosToCents } from '@/lib/format';

export type FieldErrors<T> = Partial<Record<keyof T, string>>;

export interface WishFormValues {
  name: string;
  description: string;
  product_url: string;
  price: string;
  priority: 1 | 2 | 3;
  is_surprise: boolean;
  category: string;
  notes: string;
}

export const emptyWishForm: WishFormValues = {
  name: '',
  description: '',
  product_url: '',
  price: '',
  priority: 2,
  is_surprise: false,
  category: '',
  notes: '',
};

export function validateWish(values: WishFormValues): {
  errors: FieldErrors<WishFormValues>;
  input: WishInput | null;
} {
  const errors: FieldErrors<WishFormValues> = {};
  const name = values.name.trim();
  const url = values.product_url.trim();
  const price = eurosToCents(values.price);

  if (!name) errors.name = 'Ponle un nombre al regalo.';
  else if (name.length > 120) errors.name = 'Máximo 120 caracteres.';

  if (url) {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
        errors.product_url = 'La URL debe empezar por http:// o https://';
      }
    } catch {
      errors.product_url = 'Introduce una URL válida.';
    }
  }

  if (Number.isNaN(price)) errors.price = 'Introduce un precio válido (p. ej. 35).';
  else if (price !== null && price > 10_000_00) errors.price = 'Precio demasiado alto.';

  if (values.description.length > 1000) errors.description = 'Máximo 1000 caracteres.';
  if (values.notes.length > 1000) errors.notes = 'Máximo 1000 caracteres.';
  if (values.category.length > 40) errors.category = 'Máximo 40 caracteres.';

  if (Object.keys(errors).length > 0) return { errors, input: null };

  return {
    errors,
    input: {
      name,
      description: values.description.trim() || null,
      product_url: url || null,
      image_url: null,
      approx_price_cents: price,
      priority: values.priority,
      is_surprise: values.is_surprise,
      category: values.category.trim() || null,
      notes: values.notes.trim() || null,
    },
  };
}

export function validateFamily(name: string, deadline: Date | null, christmas: Date | null) {
  const errors: { name?: string; deadline?: string; christmas?: string } = {};
  const trimmed = name.trim();
  if (!trimmed) errors.name = 'Ponle un nombre a la familia.';
  else if (trimmed.length > 80) errors.name = 'Máximo 80 caracteres.';
  if (!deadline) errors.deadline = 'Indica la fecha límite.';
  if (!christmas) errors.christmas = 'Indica la fecha de Navidad.';
  if (deadline && christmas && deadline.getTime() >= christmas.getTime()) {
    errors.deadline = 'La fecha límite debe ser anterior a la Navidad.';
  }
  return { errors, valid: Object.keys(errors).length === 0 };
}
