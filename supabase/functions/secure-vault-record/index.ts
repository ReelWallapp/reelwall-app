// @ts-nocheck
import { Uploader } from "@irys/upload";
import { Solana } from "@irys/upload-solana";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Buffer } from "node:buffer";

const APP_URL = "https://reelwall.app";

function getPublicImageUrl(value: string, supabaseUrl: string) {
  if (!value) return "";

  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value;
  }

  const cleanPath = value.replace(/^\/+/, "").replace(/^catches\//, "");

  return `${supabaseUrl}/storage/v1/object/public/catches/${cleanPath}`;
}

function createVaultMetadata(record: any, imageUrl: string) {
  const shortId = record.id.slice(0, 8).toUpperCase();

  return {
    name: `LiveWell Vault Record #${shortId}`,
    description: record.story?.trim() || "A preserved catch from ReelWall.",
    image: imageUrl,
    external_url: APP_URL,
    attributes: [
      {
        trait_type: "Record ID",
        value: `LWV-${shortId}`,
      },
      {
        trait_type: "Catch Date",
        value: record.catch_date || record.created_at || "Unknown",
      },
      {
        trait_type: "Location",
        value: record.place_name || record.region_name || "Location private",
      },
      {
        trait_type: "Personal Best",
        value: record.is_personal_best ? "Yes" : "No",
      },
      {
        trait_type: "Source",
        value: "ReelWall",
      },
    ],
  };
}

async function getIrysUploader() {
  const privateKey = Deno.env.get("IRYS_PRIVATE_KEY");

  if (!privateKey) {
    throw new Error("Missing IRYS_PRIVATE_KEY secret.");
  }

  const irysUploader = await Uploader(Solana).withWallet(JSON.parse(privateKey));

  return irysUploader;
}

serve(async (req) => {
  try {
    const { recordId } = await req.json();

    if (!recordId) {
      return new Response(JSON.stringify({ error: "Missing recordId" }), {
        status: 400,
      });
    }

    console.log("Securing vault record:", recordId);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const recordRes = await fetch(
      `${supabaseUrl}/rest/v1/vault_records?id=eq.${recordId}`,
      {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        },
      }
    );

    const records = await recordRes.json();
    const record = records?.[0];

    if (!record) {
      return new Response(JSON.stringify({ error: "Record not found" }), {
        status: 404,
      });
    }

    const imageUrl = getPublicImageUrl(
      record.original_image_url || record.image_url,
      supabaseUrl
    );

    if (!imageUrl) {
      throw new Error("No image found for this Vault record.");
    }

    const irys = await getIrysUploader();
    const price = await irys.getPrice(10000000); // enough estimate for test upload
const balance = await irys.getLoadedBalance();

console.log("Irys price:", price.toString());
console.log("Irys balance:", balance.toString());

if (balance.lt(price)) {
  console.log("Funding Irys uploader...");
  await irys.fund(price);
}

    // 1. Download original image from Supabase/public URL
    const imageRes = await fetch(imageUrl);

    if (!imageRes.ok) {
      throw new Error("Could not download Vault image.");
    }

    const imageArrayBuffer = await imageRes.arrayBuffer();
const imageBuffer = Buffer.from(imageArrayBuffer);

   console.log("STARTING IRYS IMAGE UPLOAD", imageBuffer.length);

const imageReceipt = await irys.upload(imageBuffer, {
  tags: [
    { name: "Content-Type", value: "image/jpeg" },
    { name: "App-Name", value: "LiveWell Vault" },
    { name: "Vault-Record-Id", value: record.id },
    { name: "Data-Type", value: "vault-image" },
  ],
});

console.log("IRYS IMAGE UPLOAD DONE", imageReceipt.id);
    const arweaveImageUrl = `https://gateway.irys.xyz/${imageReceipt.id}`;

    // 3. Create metadata with permanent image URL
    const metadata = createVaultMetadata(record, arweaveImageUrl);
    const metadataJson = JSON.stringify(metadata, null, 2);

    // 4. Upload metadata to Irys / Arweave
    const metadataReceipt = await irys.upload(Buffer.from(metadataJson), {
      tags: [
        { name: "Content-Type", value: "application/json" },
        { name: "App-Name", value: "LiveWell Vault" },
        { name: "Vault-Record-Id", value: record.id },
        { name: "Data-Type", value: "vault-metadata" },
      ],
    });

    const arweaveMetadataUrl = `https://gateway.irys.xyz/${metadataReceipt.id}`;

    // 5. Save permanent proof URLs to Supabase
    const updateRes = await fetch(
      `${supabaseUrl}/rest/v1/vault_records?id=eq.${recordId}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          Prefer: "return=representation",
        },
        body: JSON.stringify({
          arweave_image_url: arweaveImageUrl,
          arweave_metadata_url: arweaveMetadataUrl,
          metadata_url: arweaveMetadataUrl,
          mint_status: "minted",
          secured_at: new Date().toISOString(),
        }),
      }
    );

    if (!updateRes.ok) {
      const text = await updateRes.text();
      throw new Error(`Could not update vault record: ${text}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Vault record secured",
        arweave_image_url: arweaveImageUrl,
        arweave_metadata_url: arweaveMetadataUrl,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.log("Secure Vault error:", err);

    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
    });
  }
});