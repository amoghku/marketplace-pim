import type { Schema, Struct } from '@strapi/strapi';

export interface MediaAssetSlot extends Struct.ComponentSchema {
  collectionName: 'components_media_asset_slots';
  info: {
    description: 'Master product media slot';
    displayName: 'Asset Slot';
  };
  attributes: {
    alt_text: Schema.Attribute.String;
    file: Schema.Attribute.Media & Schema.Attribute.Required;
    position: Schema.Attribute.Integer & Schema.Attribute.Required;
    source_type: Schema.Attribute.Enumeration<['master', 'vendor']> &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'master'>;
  };
}

export interface PricingValuePerPoint extends Struct.ComponentSchema {
  collectionName: 'components_pricing_value_per_points';
  info: {
    description: 'Overrides the monetary value for a point in a specific currency and sales channel';
    displayName: 'Value Per Point';
  };
  attributes: {
    currency: Schema.Attribute.Relation<'manyToOne', 'api::currency.currency'> &
      Schema.Attribute.Required;
    sales_channel: Schema.Attribute.Relation<
      'manyToOne',
      'api::sales-channel.sales-channel'
    > &
      Schema.Attribute.Required;
    vpp: Schema.Attribute.Decimal &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      >;
  };
}

export interface ProductOptionDefinition extends Struct.ComponentSchema {
  collectionName: 'components_product_option_definitions';
  info: {
    displayName: 'Option Definition';
  };
  attributes: {
    name: Schema.Attribute.String & Schema.Attribute.Required;
    values: Schema.Attribute.JSON & Schema.Attribute.DefaultTo<[]>;
  };
}

export interface ProductVariantBlueprint extends Struct.ComponentSchema {
  collectionName: 'components_product_variant_blueprints';
  info: {
    displayName: 'Variant Blueprint';
  };
  attributes: {
    option_values: Schema.Attribute.JSON & Schema.Attribute.DefaultTo<{}>;
    price: Schema.Attribute.Decimal &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      >;
    sku_suffix: Schema.Attribute.String;
    title: Schema.Attribute.String & Schema.Attribute.Required;
  };
}

export interface SharedSeoMetadata extends Struct.ComponentSchema {
  collectionName: 'components_shared_seo_metadata';
  info: {
    displayName: 'SEO Metadata';
  };
  attributes: {
    description: Schema.Attribute.Text;
    keywords: Schema.Attribute.JSON & Schema.Attribute.DefaultTo<[]>;
    title: Schema.Attribute.String;
  };
}

declare module '@strapi/strapi' {
  export module Public {
    export interface ComponentSchemas {
      'media.asset-slot': MediaAssetSlot;
      'pricing.value-per-point': PricingValuePerPoint;
      'product.option-definition': ProductOptionDefinition;
      'product.variant-blueprint': ProductVariantBlueprint;
      'shared.seo-metadata': SharedSeoMetadata;
    }
  }
}
