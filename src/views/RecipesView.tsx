import { useEffect, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { formatNumber } from '@/lib/format';
import { ChefHat, Plus, Play, Trash2, FlaskConical } from 'lucide-react';
import type { Product, Warehouse, Recipe, RecipeIngredient } from '@/types';
import { fetchProducts, fetchWarehouses, fetchRecipes, createRecipe, applyRecipe } from '@/lib/data';

export function RecipesView() {
  const { isGlobal, selectedCompanyId, selectedCompany } = useApp();
  const [recipes, setRecipes] = useState<(Recipe & { output_product: Product })[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [applyModal, setApplyModal] = useState<Recipe | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [rcps, prods] = await Promise.all([
        fetchRecipes(selectedCompanyId || undefined),
        fetchProducts(),
      ]);
      setRecipes(rcps);
      setProducts(prods);
      if (selectedCompanyId) {
        const whs = await fetchWarehouses(selectedCompanyId);
        setWarehouses(whs);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [selectedCompanyId]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Recetas / Producción</h1>
          <p className="mt-1 text-sm text-gray-500">
            {isGlobal ? 'Recetas de todas las empresas' : `Recetas de ${selectedCompany?.name}`}
          </p>
        </div>
        {!isGlobal && selectedCompanyId && (
          <Button onClick={() => setShowModal(true)}>
            <Plus size={16} /> Nueva Receta
          </Button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-400">Cargando recetas...</div>
      ) : recipes.length === 0 ? (
        <Card>
          <div className="py-8 text-center">
            <ChefHat size={32} className="mx-auto text-gray-300" />
            <p className="mt-2 text-sm text-gray-400">Sin recetas registradas</p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {recipes.map((r) => {
            const ingredients = (r.ingredients as unknown as RecipeIngredient[]) || [];
            return (
              <Card key={r.id}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <FlaskConical size={18} className="text-teal-600" />
                      <h3 className="text-base font-semibold text-gray-900">{r.name}</h3>
                    </div>
                    <p className="mt-1 text-sm text-gray-500">
                      Produce: <span className="font-medium text-gray-900">{r.output_product?.name}</span> × {formatNumber(r.output_quantity)}
                    </p>
                  </div>
                  {!isGlobal && selectedCompanyId && (
                    <Button size="sm" onClick={() => setApplyModal(r)}>
                      <Play size={14} /> Aplicar
                    </Button>
                  )}
                </div>
                <div className="mt-3 border-t border-gray-100 pt-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">Ingredientes</p>
                  <div className="space-y-1">
                    {ingredients.map((ing, idx) => {
                      const p = products.find((p) => p.id === ing.product_id);
                      return (
                        <div key={idx} className="flex justify-between text-sm">
                          <span className="text-gray-600">{ing.product_name || p?.name}</span>
                          <span className="font-medium text-gray-900">{formatNumber(ing.quantity)} {p?.unit || 'unidad'}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {showModal && selectedCompanyId && (
        <RecipeModal
          products={products}
          companyId={selectedCompanyId}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load(); }}
        />
      )}

      {applyModal && selectedCompanyId && (
        <ApplyRecipeModal
          recipe={applyModal}
          warehouses={warehouses}
          companyId={selectedCompanyId}
          onClose={() => setApplyModal(null)}
          onSaved={() => { setApplyModal(null); load(); }}
        />
      )}
    </div>
  );
}

function RecipeModal({ products, companyId, onClose, onSaved }: {
  products: Product[];
  companyId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState('');
  const [outputProductId, setOutputProductId] = useState('');
  const [outputQuantity, setOutputQuantity] = useState(1);
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([]);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [qty, setQty] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addIngredient = () => {
    const product = products.find((p) => p.id === selectedProduct);
    if (!product || qty < 1) return;
    setIngredients([...ingredients, { product_id: product.id, product_name: product.name, quantity: qty }]);
    setSelectedProduct('');
    setQty(1);
  };

  const removeIngredient = (idx: number) => setIngredients(ingredients.filter((_, i) => i !== idx));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (ingredients.length === 0) { setError('Agregue al menos un ingrediente'); return; }
    if (!outputProductId) { setError('Seleccione el producto de salida'); return; }
    setSaving(true);
    setError(null);
    try {
      await createRecipe(companyId, name, outputProductId, outputQuantity, ingredients);
      onSaved();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={true} onClose={onClose} title="Nueva Receta" maxWidth="max-w-2xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-lg bg-teal-50 px-3 py-2 text-xs text-teal-700">
          La receta consume ingredientes del inventario y produce un producto de salida. Ej: 1 paquete de papas rinde X porciones.
        </div>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-700">Nombre de la Receta</span>
          <input required value={name} onChange={(e) => setName(e.target.value)} className="input" />
        </label>
        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">Producto de Salida</span>
            <select required value={outputProductId} onChange={(e) => setOutputProductId(e.target.value)} className="input">
              <option value="">Seleccionar...</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">Cantidad Producida</span>
            <input type="number" min="1" required value={outputQuantity} onChange={(e) => setOutputQuantity(Number(e.target.value))} className="input" />
          </label>
        </div>

        <div className="rounded-lg border border-gray-200 p-3">
          <p className="mb-2 text-sm font-medium text-gray-700">Agregar Ingrediente</p>
          <div className="grid grid-cols-12 gap-2">
            <div className="col-span-7">
              <select value={selectedProduct} onChange={(e) => setSelectedProduct(e.target.value)} className="input">
                <option value="">Seleccionar...</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="col-span-3">
              <input type="number" min="1" placeholder="Cant." value={qty} onChange={(e) => setQty(Number(e.target.value))} className="input" />
            </div>
            <div className="col-span-2">
              <Button type="button" variant="secondary" onClick={addIngredient} className="w-full">Agregar</Button>
            </div>
          </div>
        </div>

        {ingredients.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-gray-100">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr className="text-left text-xs uppercase tracking-wider text-gray-400">
                  <th className="px-3 py-2 font-medium">Ingrediente</th>
                  <th className="px-3 py-2 font-medium text-right">Cantidad</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {ingredients.map((ing, idx) => (
                  <tr key={idx}>
                    <td className="px-3 py-2 font-medium text-gray-900">{ing.product_name}</td>
                    <td className="px-3 py-2 text-right text-gray-700">{ing.quantity}</td>
                    <td className="px-3 py-2">
                      <button type="button" onClick={() => removeIngredient(idx)} className="text-red-400 hover:text-red-600">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={saving}>
            <ChefHat size={16} /> {saving ? 'Guardando...' : 'Crear Receta'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function ApplyRecipeModal({ recipe, warehouses, companyId, onClose, onSaved }: {
  recipe: Recipe;
  warehouses: Warehouse[];
  companyId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id || '');
  const [batches, setBatches] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const result = await applyRecipe(recipe.id, warehouseId, companyId, batches, 'Administrador');
      if (!result.success) { setError(result.error); return; }
      onSaved();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={true} onClose={onClose} title={`Aplicar Receta — ${recipe.name}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-lg bg-gray-50 p-3 text-sm">
          <p className="text-gray-500">Producirá: <span className="font-medium text-gray-900">{recipe.output_quantity * batches} unidades</span></p>
        </div>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-700">Bodega</span>
          <select required value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} className="input">
            {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-700">Número de Lotes</span>
          <input type="number" min="1" required value={batches} onChange={(e) => setBatches(Number(e.target.value))} className="input" />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={saving}>
            <Play size={16} /> {saving ? 'Procesando...' : 'Aplicar Receta'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
