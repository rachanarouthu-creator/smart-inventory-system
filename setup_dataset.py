import os
import shutil
from PIL import Image, ImageEnhance

SRC_IMAGES = {
    "maggie": r"C:\Users\bhuva\.gemini\antigravity-ide\brain\dec44ba4-20ab-44f5-be16-c12df1a58b03\maggi_noodles_pack_1790960245480.jpg",
    "tea_powder": r"C:\Users\bhuva\.gemini\antigravity-ide\brain\dec44ba4-20ab-44f5-be16-c12df1a58b03\red_label_tea_1790960269796.jpg",
    "toothpaste": r"C:\Users\bhuva\.gemini\antigravity-ide\brain\dec44ba4-20ab-44f5-be16-c12df1a58b03\colgate_toothpaste_1790960294703.jpg",
    "biscuits": r"C:\Users\bhuva\.gemini\antigravity-ide\brain\dec44ba4-20ab-44f5-be16-c12df1a58b03\parle_g_biscuits_1790960321081.jpg",
    "salt": r"C:\Users\bhuva\.gemini\antigravity-ide\brain\dec44ba4-20ab-44f5-be16-c12df1a58b03\tata_salt_pack_1790960342190.jpg",
}

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
DATASET_DIRS = [
    os.path.join(ROOT_DIR, "dataset"),
    os.path.join(ROOT_DIR, "backend", "dataset"),
]
TEST_IMAGES_DIR = os.path.join(ROOT_DIR, "sample_test_images")
UPLOADS_DIRS = [
    os.path.join(ROOT_DIR, "uploads"),
    os.path.join(ROOT_DIR, "backend", "uploads"),
]

os.makedirs(TEST_IMAGES_DIR, exist_ok=True)
for u in UPLOADS_DIRS:
    os.makedirs(u, exist_ok=True)

# 1. Populate new products in datasets with 3 variations each
for p_name, img_path in SRC_IMAGES.items():
    if not os.path.exists(img_path):
        print(f"Warning: {img_path} not found")
        continue

    img = Image.open(img_path).convert("RGB")

    # Variation 1: original resized to standard high-res
    img_v1 = img.copy()

    # Variation 2: slightly cropped & zoomed
    w, h = img.size
    crop_box = (int(w * 0.05), int(h * 0.05), int(w * 0.95), int(h * 0.95))
    img_v2 = img.crop(crop_box).resize((w, h), Image.Resampling.LANCZOS)

    # Variation 3: slight brightness / contrast adjust (simulating different lighting)
    enhancer = ImageEnhance.Brightness(img)
    img_v3 = enhancer.enhance(1.08)
    img_v3 = ImageEnhance.Contrast(img_v3).enhance(1.05)

    variations = [
        (f"{p_name}-1.jpeg", img_v1),
        (f"{p_name}-2.jpeg", img_v2),
        (f"{p_name}-3.jpeg", img_v3),
    ]

    for d_dir in DATASET_DIRS:
        target_folder = os.path.join(d_dir, p_name)
        os.makedirs(target_folder, exist_ok=True)
        for fname, v_img in variations:
            dest = os.path.join(target_folder, fname)
            v_img.save(dest, "JPEG", quality=92)
            print(f"Saved: {dest}")

    # Save to sample_test_images
    sample_path = os.path.join(TEST_IMAGES_DIR, f"sample_{p_name}.jpg")
    img_v1.save(sample_path, "JPEG", quality=95)

    # Save to uploads
    for u in UPLOADS_DIRS:
        u_path = os.path.join(u, f"{p_name}.jpg")
        img_v1.save(u_path, "JPEG", quality=95)

# Also copy existing products to sample_test_images and uploads
EXISTING_PRODUCTS = {
    "horlicks": "dataset/horlicks/1786064787778.jpg",
    "harpic": "dataset/harpic/harpic-1.jpeg",
    "kissan": "dataset/kissan/kissan-1.jpeg",
    "oil": "dataset/oil/oil-1.jpeg",
    "soya_sauce": "dataset/soya_sos/soya sos-1.jpeg",
    "coriander_powder": "dataset/coriander_powder/coriander powder1.jpeg",
}

for name, rel_path in EXISTING_PRODUCTS.items():
    full_path = os.path.join(ROOT_DIR, rel_path)
    if os.path.exists(full_path):
        sample_path = os.path.join(TEST_IMAGES_DIR, f"sample_{name}.jpg")
        shutil.copy2(full_path, sample_path)
        for u in UPLOADS_DIRS:
            u_path = os.path.join(u, f"{name}.jpg")
            shutil.copy2(full_path, u_path)
        print(f"Copied existing: {name} -> {sample_path}")

print("Dataset & sample images setup complete!")
