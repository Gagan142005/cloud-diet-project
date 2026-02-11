import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
 
df = pd.read_csv("All_Diets.csv")
df.columns = df.columns.str.strip()
 
for col in ["Protein(g)", "Carbs(g)", "Fat(g)"]:
    df[col] = pd.to_numeric(df[col], errors="coerce")
 
df.fillna(df.mean(numeric_only=True), inplace=True)
 
avg_macros = df.groupby("Diet_type")[["Protein(g)", "Carbs(g)", "Fat(g)"]].mean()
print("\n=== Average Macronutrients per Diet Type ===\n")
print(avg_macros)
 
top_protein = df.sort_values("Protein(g)", ascending=False).groupby("Diet_type").head(5)
print("\n=== Top 5 Protein-Rich Recipes per Diet Type ===\n")
print(top_protein[["Diet_type", "Recipe_name", "Protein(g)"]])
 
highest_protein_diet = avg_macros["Protein(g)"].idxmax()
print("\nDiet with highest average protein:", highest_protein_diet)
 
df["Protein_to_Carbs_ratio"] = df["Protein(g)"] / df["Carbs(g)"].replace(0, pd.NA)
df["Carbs_to_Fat_ratio"] = df["Carbs(g)"] / df["Fat(g)"].replace(0, pd.NA)
 
avg_reset = avg_macros.reset_index().melt(id_vars="Diet_type", var_name="Macro", value_name="Average")
 
plt.figure(figsize=(12,6))
sns.barplot(data=avg_reset, x="Diet_type", y="Average", hue="Macro")
plt.xticks(rotation=45, ha="right")
plt.title("Average Macronutrients by Diet Type")
plt.tight_layout()
plt.savefig("avg_macros_bar.png")
plt.show()
 
plt.figure(figsize=(10,6))
sns.heatmap(avg_macros, cmap="viridis")
plt.title("Heatmap of Average Macronutrients")
plt.tight_layout()
plt.savefig("avg_macros_heatmap.png")
plt.show()
 
plt.figure(figsize=(10,6))
sns.scatterplot(data=top_protein, x="Carbs(g)", y="Protein(g)", hue="Cuisine_type")
plt.title("Top Protein Recipes Distribution")
plt.tight_layout()
plt.savefig("top_protein_scatter.png")
plt.show()
 
print("\nCharts saved successfully.")