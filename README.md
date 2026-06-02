# Modul 2: Ausgabentracker mit Hierarchischen Kategorien

Dieses Modul ermöglicht den Import von Bank-CSV-Dateien und die Auswertung der Ausgaben mit einem leistungsfähigen hierarchischen Kategorie-System.

## 🏗️ Hierarchisches Kategorie-System

### **3-Level-Struktur**
- **Hauptkategorien**: Lebensmittel, Urlaub, Wohnen, etc.
- **Unterkategorien**: Milchprodukte, Backwaren, Getränke, etc.
- **Unter-Unterkategorien**: Rewe-Milchprodukte, Aldi-Backwaren, etc.

### **Beispiel-Hierarchie**
```
Lebensmittel
├── Milchprodukte
│   ├── Rewe-Milchprodukte (Filter: "rewe" + "milch,joghurt,käse")
│   ├── Aldi-Milchprodukte (Filter: "aldi" + "milch,joghurt,käse")
│   └── Penny-Milchprodukte (Filter: "penny" + "milch,joghurt,käse")
├── Backwaren
│   ├── Rewe-Backwaren (Filter: "rewe" + "brot,brötchen")
│   └── Lidl-Backwaren (Filter: "lidl" + "brot,brötchen")
└── Getränke
    └── Alle-Stores (Filter: "getränke,wasser,cola")

Urlaub
├── Flüge (Filter: "flug,airline,lufthansa,ryanair")
├── Hotels (Filter: "hotel,booking,airbnb")
└── Auto (Filter: "mietwagen,sixt,hertz")
```

## 🔍 Filter-System
- **Kombinierte Filter**: Mehrere Schlüsselwörter pro Kategorie
- **Store-spezifisch**: Unterscheidung nach Geschäften
- **Produkt-spezifisch**: Unterscheidung nach Produkttypen
- **Automatische Zuordnung**: Basierend auf Payee und Beschreibung

## 📊 Analytics & Visualisierung

### **Hierarchische Analyse**
- **Gesamtübersicht**: Wie viel wurde für "Backwaren" insgesamt ausgegeben
- **Store-Analyse**: Welcher Store hat die meisten Backwaren verkauft
- **Produkt-Analyse**: Welche Produktkategorie dominiert bei welchem Store
- **Dynamische Sankey-Diagramme**: Zeigt Geldflüsse basierend auf aktueller Kategorie-Ebene

### **Interaktive Navigation**
- **Klick auf Kategorie**: Zeigt Unterkategorien
- **Zurück-Button**: Zur vorherigen Ebene
- **Breadcrumb-Navigation**: Zeigt aktuellen Pfad

## 🎯 Verwendungsbeispiele

### **Analyse-Szenarien**
1. **"Wie viel gebe ich für Backwaren insgesamt aus?"**
   - Hauptkategorie: Lebensmittel → Backwaren

2. **"Wo kaufe ich am meisten Backwaren?"**
   - Hauptkategorie: Lebensmittel → Backwaren → Store-Aufschlüsselung

3. **"Wie verteilen sich meine Urlaubsausgaben?"**
   - Hauptkategorie: Urlaub → Flüge/Hotels/Auto

4. **"Welche Milchprodukte kaufe ich wo?"**
   - Hauptkategorie: Lebensmittel → Milchprodukte → Store-Aufschlüsselung

## 🛠️ Features

### **Kategorie-Verwaltung**
- **Drag & Drop**: Hierarchische Struktur erstellen
- **Filter-Erstellung**: Pro Kategorie-Ebene individuelle Filter
- **Farben & Icons**: Visuelle Unterscheidung
- **Standard-Vorlagen**: Vorkonfigurierte Kategorien

### **Import & Kategorisierung**
- **CSV-Import**: Unterstützt alle gängigen Bankformate
- **Auto-Kategorisierung**: Basierend auf hierarchischen Filtern
- **Manuelle Nachbearbeitung**: In der Review-Tabelle
- **Neukategorisierung**: Bei Filter-Änderungen

### **Visualisierung**
- **Hierarchische Sankey-Diagramme**: Dynamische Geldflüsse
- **Store-Analyse**: Geschäftsspezifische Auswertungen
- **Produkt-Kategorien**: Detaillierte Aufschlüsselungen
- **Zeitreihen**: Entwicklung über Zeit

## 🚀 Erweiterte Nutzung

### **Store-spezifische Analyse**
- Vergleich: Rewe vs. Aldi vs. Lidl für Milchprodukte
- Preisvergleich: Welcher Store ist für welche Produkte günstiger
- Häufigkeit: Wo kaufe ich am häufigsten welche Produkte

### **Produkt-Kategorien**
- Gesamtausgaben: Alle Backwaren zusammen
- Store-Verteilung: Welcher Store liefert welche Produkte
- Trend-Analyse: Veränderung über Zeit

Das System ermöglicht sowohl grobe Übersichten als auch detaillierte Analysen auf allen Ebenen der Hierarchie!