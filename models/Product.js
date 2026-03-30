const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true }, // Sync with existing JSON ID (e.g., 'p1')
    // Frontend uses `collection`, some server prompts used `collectionName`.
    // Support both and keep them in sync.
    collection: {
      type: String,
      trim: true,
      validate: {
        validator: function (value) {
          return Boolean((value && String(value).trim()) || (this.collectionName && String(this.collectionName).trim()));
        },
        message: 'Product requires a collection.'
      }
    },
    collectionName: { type: String, trim: true },
    name: { type: String, required: true, trim: true },
    price: String,
    originalPrice: String,
    imageUrl: String,
    category: String,
    description: String,
    categoryId: {
      material: String,
      priceRange: String,
      features: String
    }
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => {
        ret.collection = ret.collection || ret.collectionName || '';
        ret.collectionName = ret.collectionName || ret.collection || '';
        return ret;
      }
    },
    toObject: {
      virtuals: true,
      transform: (_doc, ret) => {
        ret.collection = ret.collection || ret.collectionName || '';
        ret.collectionName = ret.collectionName || ret.collection || '';
        return ret;
      }
    }
  }
);

productSchema.pre('validate', function (next) {
  const collection = typeof this.collection === 'string' ? this.collection.trim() : '';
  const collectionName = typeof this.collectionName === 'string' ? this.collectionName.trim() : '';

  if (!collection && collectionName) this.collection = collectionName;
  if (!collectionName && collection) this.collectionName = collection;

  next();
});

module.exports = mongoose.model('Product', productSchema);
