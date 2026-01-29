/**
 * Default values for a {@link Foo}
 */
export const DEFAULT_FOO = {
    /** Whether the foo is sortable. */
    isSortable: false,
    /** Whether the foo is wrappable. */
    wrappable: 'none',
    /** If wrapping a foo, the maximum number of lines the row can use. */
    maxLines: 2,
    /** Format input value for display. */
    formatter: (value: any) => String(value ?? '')
} as const;

/**
 * Foo Props
 * 
 * @property {boolean} [isSortable] - Whether the foo is sortable. {@defaultLink DEFAULT_FOO.isSortable}
 * @property {'none' | 'word' | 'hard'} [wrappable] - Whether the foo is wrappable. {@defaultLink DEFAULT_FOO.wrappable}
 * @property {number} [maxLines] - If wrapping a foo, the maximum number of lines the row can use. {@defaultLink DEFAULT_FOO.maxLines}
 * @property {(value: any) => string} [formatter] - convert/format foo value from data source to table. {@defaultLink DEFAULT_FOO.formatter}
 * 
 * @example
 * ```typescript
 * const myFoo: Foo = {
 *     ...DEFAULT_FOO,
 *     isSortable: 'true'
 * };
 * ```
 */
export interface Foo {
    isSortable?: boolean;
    wrappable?: 'none' | 'word' | 'hard';
    maxLines?: number;
    formatter?: (value: any) => string;
}


