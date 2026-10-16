import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { AdminApi } from '../../../../core/services/verdiq/admin-api';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { ToastService } from '../../../../core/services/toast.service';
import { SkeletonComponent } from '../../../../shared/components/skeleton/skeleton.component';
import {
  ProductDetail as ProductDetailModel,
  ProductCreate,
  ProductUpdate,
} from '../../../../core/models/verdiq/product.model';

// Product edit form. name/brand/category/market are plain text inputs
// (matching how they're stored); ingredients is a text field (wrapped as
// { text } server-side) and nutrition is a raw JSON textarea, since neither
// has a fixed schema anywhere in the backend.
//
// Doubles as the CREATE form: the 'products/new' route resolves to this same
// component (registered before 'products/:id' in app.routes.ts) with no
// product to load — `isNew` skips the load and posts instead of patching on
// save. Kept as one component rather than a fork because the two forms are
// otherwise identical field-for-field.
@Component({
  selector: 'app-product-detail',
  imports: [SkeletonComponent, PageHeaderComponent, FormsModule],
  templateUrl: './product-detail.html',
  styleUrl: './product-detail.sass',
})
export class ProductDetail {
  private api = inject(AdminApi);
  private readonly toast = inject(ToastService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  // 'products/new' is a STATIC route with no :id param — paramMap.get('id')
  // returns null there, not the string 'new'. 'products/:id' always has a
  // real id when matched (the static route wins on the literal 'new'
  // segment), so null-or-'new' both mean "this is the create form".
  private readonly id = this.route.snapshot.paramMap.get('id');
  readonly isNew = this.id === null || this.id === 'new';

  readonly product = signal<ProductDetailModel | null>(null);
  readonly loading = signal(!this.isNew);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  // Form fields, populated once the product loads (blank for a new product).
  name = '';
  brand = '';
  category = '';
  market = '';
  barcode = '';
  ingredientsText = '';
  nutritionJson = '';

  constructor() {
    if (!this.isNew) this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    // Only called when !isNew, so id is guaranteed a real string here.
    this.api.getProduct(this.id!).subscribe({
      next: (p) => {
        this.product.set(p);
        this.name = p.name ?? '';
        this.brand = p.brand ?? '';
        this.category = p.category ?? '';
        this.market = p.market ?? '';
        this.barcode = p.barcode ?? '';
        this.ingredientsText = p.ingredients_text ?? '';
        this.nutritionJson = p.nutrition ? JSON.stringify(p.nutrition, null, 2) : '';
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Could not load product.');
        this.loading.set(false);
      },
    });
  }

  save(): void {
    this.error.set(null);

    if (this.isNew && !this.name.trim()) {
      this.error.set('Name is required.');
      return;
    }

    // Validate the nutrition JSON client-side too, so a typo doesn't round-
    // trip to the server just to bounce back — but the server re-validates
    // regardless (never trust the client).
    if (this.nutritionJson.trim()) {
      try {
        JSON.parse(this.nutritionJson);
      } catch {
        this.error.set('Nutrition is not valid JSON.');
        return;
      }
    }

    this.saving.set(true);

    if (this.isNew) {
      const body: ProductCreate = {
        barcode: this.barcode.trim() || undefined,
        name: this.name.trim(),
        brand: this.brand.trim(),
        category: this.category.trim(),
        market: this.market.trim(),
        ingredientsText: this.ingredientsText.trim(),
        nutritionJson: this.nutritionJson.trim() || null,
      };
      this.api.createProduct(body).subscribe({
        next: (created) => {
          // Land on the edit form for the row just created — arriving there
          // with the fields already populated is itself the confirmation.
          this.router.navigate(['/apps/verdiq/products', created.id]);
        },
        error: (e) => {
          this.saving.set(false);
          this.error.set(
            e?.error?.error === 'barcode_exists'
              ? 'That barcode is already in the catalog. Edit the existing product instead.'
              : e?.error?.error === 'invalid_nutrition_json'
                ? 'Nutrition is not valid JSON.'
                : 'Could not create the product.',
          );
        },
      });
      return;
    }

    const body: ProductUpdate = {
      name: this.name.trim(),
      brand: this.brand.trim(),
      category: this.category.trim(),
      market: this.market.trim(),
      ingredientsText: this.ingredientsText.trim(),
      nutritionJson: this.nutritionJson.trim() || null,
    };

    // Only reached when !isNew (the `if (this.isNew) { ...; return; }` above
    // already handled the create path), so id is guaranteed a real string.
    this.api.updateProduct(this.id!, body).subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success('Saved.');
      },
      error: (e) => {
        this.saving.set(false);
        this.error.set(
          e?.error?.error === 'invalid_nutrition_json'
            ? 'Nutrition is not valid JSON.'
            : 'Could not save the product.',
        );
      },
    });
  }

  back(): void {
    this.router.navigate(['/apps/verdiq/products']);
  }
}
