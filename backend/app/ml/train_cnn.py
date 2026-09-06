"""
MobileNetV2 Transfer Learning Script for Smart Pantry Expiry Tracker.
Generalizes significantly better than raw pixel KNN across lighting, rotations, and background changes.

Requirements:
    pip install torch torchvision
"""

import os
import sys

def train_mobilenet():
    try:
        import torch
        import torch.nn as nn
        import torch.optim as optim
        from torchvision import datasets, models, transforms
        from torch.utils.data import DataLoader
    except ImportError:
        print("[Train CNN] PyTorch / torchvision is not installed in the current environment.")
        print("To train with MobileNetV2, install via: pip install torch torchvision")
        sys.exit(1)

    # Locate dataset directory
    candidates = [
        "dataset",
        "backend/dataset",
        os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "dataset"),
    ]
    dataset_dir = None
    for path in candidates:
        if os.path.exists(path) and os.path.isdir(path):
            dataset_dir = path
            break

    if not dataset_dir:
        print("[Train CNN] Could not locate 'dataset' folder.")
        sys.exit(1)

    print(f"[Train CNN] Training MobileNetV2 using dataset at: {dataset_dir}")

    # Data augmentation for robust real-world kitchen photos
    data_transforms = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.RandomHorizontalFlip(),
        transforms.RandomRotation(15),
        transforms.ColorJitter(brightness=0.2, contrast=0.2, saturation=0.2),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
    ])

    dataset = datasets.ImageFolder(dataset_dir, transform=data_transforms)
    class_names = dataset.classes
    print(f"[Train CNN] Found classes: {class_names}")

    dataloader = DataLoader(dataset, batch_size=4, shuffle=True, num_workers=0)

    device = torch.device("cuda:0" if torch.cuda.is_available() else "cpu")
    print(f"[Train CNN] Training on device: {device}")

    # Load MobileNetV2 pretrained backbone
    model = models.mobilenet_v2(weights=models.MobileNet_V2_Weights.DEFAULT)

    # Freeze feature backbone
    for param in model.features.parameters():
        param.requires_grad = False

    # Replace classification head
    model.classifier[1] = nn.Linear(model.last_channel, len(class_names))
    model = model.to(device)

    criterion = nn.CrossEntropyLoss()
    optimizer = optim.Adam(model.classifier.parameters(), lr=0.001)

    epochs = 10
    model.train()
    for epoch in range(epochs):
        running_loss = 0.0
        corrects = 0

        for inputs, labels in dataloader:
            inputs = inputs.to(device)
            labels = labels.to(device)

            optimizer.zero_grad()
            outputs = model(inputs)
            loss = criterion(outputs, labels)
            loss.backward()
            optimizer.step()

            _, preds = torch.max(outputs, 1)
            running_loss += loss.item() * inputs.size(0)
            corrects += torch.sum(preds == labels.data)

        epoch_loss = running_loss / len(dataset)
        epoch_acc = corrects.double() / len(dataset)
        print(f"Epoch {epoch+1}/{epochs} - Loss: {epoch_loss:.4f} - Acc: {epoch_acc:.4f}")

    # Save model checkpoint
    output_path = "model_cnn.pt"
    checkpoint = {
        "classes": class_names,
        "state_dict": model.state_dict()
    }
    torch.save(checkpoint, output_path)
    print(f"[Train CNN] CNN MobileNetV2 successfully saved to: {output_path}")

if __name__ == "__main__":
    train_mobilenet()
