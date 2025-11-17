# =======================================================
# Roman vs Modern Roads — Top 7 European Countries (maps + table)
# =======================================================
library(sf)
library(dplyr)
library(ggplot2)
library(ggtext)
library(osmextract)
library(rnaturalearth)
library(purrr)
library(glue)
library(here)
library(readr)

# --- Color palette -------------------------------------------------------
col_bg  <- "#023047"
col_old <- "#FB8500"   # Ancient
col_new <- "#8ECAE6"   # Modern

# --- 1. Ancient roads -----------------------------------------------------
url <- "https://itiner-e.org/route-segments/download"
df_roads <- st_read(url, quiet = TRUE) |>
  filter(type %in% c("Main Road", "Secondary Road"))

# --- 2. Country polygons --------------------------------------------------
countries <- ne_countries(scale = "medium", returnclass = "sf") |>
  st_transform(st_crs(df_roads))

#target_countries <- c("United Kingdom")
target_countries <- c("France","Spain","Turkey")

# --- 3. Helper function: compute overlap & save maps ----------------------
process_country <- function(country_name) {
  message("Processing ", country_name, " ...")
  
  # --- Clip country polygon -----------------------------------------------
  cpoly <- countries |> filter(admin == country_name)
  if (country_name == "United Kingdom") {
    # Crop to mainland UK only (exclude far western islands)
    cpoly <- st_crop(cpoly, xmin = -8, xmax = 2, ymin = 49, ymax = 61)
    ancient_ctry <- suppressWarnings(st_intersection(df_roads, cpoly))
    modern_ctry <- suppressWarnings(st_intersection(modern_ctry, cpoly))
  }
  ancient_ctry <- suppressWarnings(st_intersection(df_roads, cpoly))
  if (nrow(ancient_ctry) == 0) return(NULL)
  
  # --- Load modern roads --------------------------------------------------
  modern_ctry <- oe_get(
    tolower(gsub(" ", "-", country_name)),
    layer = "lines",
    query = "SELECT * FROM lines WHERE highway IN ('motorway','trunk','primary')"
  )
  modern_ctry <- st_transform(modern_ctry, st_crs(df_roads))
  modern_ctry <- suppressWarnings(st_intersection(modern_ctry, cpoly))
  
  # --- Simplify geometries for speed -------------------------------------
  ancient_ctry <- st_simplify(ancient_ctry, 0.001)
  modern_ctry  <- st_simplify(modern_ctry, 0.001)
  
  # --- Overlaps (1.5 km tolerance) ---------------------------------------
  overlap_dist <- 0.015  # ~1.5 km
  
  # Ancient roads that coincide with modern ones
  ancient_overlap <- st_filter(
    ancient_ctry, modern_ctry,
    .predicate = \(a, b) st_is_within_distance(a, b, overlap_dist)
  )
  
  # Modern roads that coincide with Roman roads
  modern_overlap <- st_filter(
    modern_ctry, ancient_ctry,
    .predicate = \(a, b) st_is_within_distance(a, b, overlap_dist)
  )
  
  # --- Unite disjoint modern overlaps into continuous features -------------
  modern_overlap <- modern_overlap |>
    st_union() |>               # merge everything touching or overlapping
    st_line_merge() |>          # ensure proper single-line geometry
    st_cast("MULTILINESTRING")  # unified object for plotting
  
  # Same for ancient overlaps (for consistency)
  ancient_overlap <- ancient_overlap |>
    st_union() |>
    st_line_merge() |>
    st_cast("MULTILINESTRING")
  
  # --- Compute lengths ----------------------------------------------------
  len_km <- function(x) {
    if (is.null(x) || length(x) == 0) return(0)
    sum(as.numeric(st_length(x))) / 1000
  }
  
  pct_ancient <- len_km(ancient_overlap) / len_km(ancient_ctry) * 100
  pct_modern  <- len_km(modern_overlap)  / len_km(modern_ctry)  * 100
  
  # --- Plot 1: modern roads with Roman roots ------------------------------
  # p1 <- ggplot() +
  #   # base: all modern roads (muted blue)
  #   geom_sf(data = modern_ctry, color = "#219EBC", linewidth = 0.15, alpha = 0.3) +
  #   # highlight: continuous modern overlaps (bright blue)
  #   geom_sf(data = modern_overlap, color = "#8ECAE6", linewidth = 0.6, alpha = 0.9) +
  #   annotate(
  #     "richtext",
  #     label = glue("Which modern roads were once Roman?<br><span style='font-size:14pt;'>{round(pct_modern,1)}%</span> overlap"),
  #     x = st_bbox(cpoly)[1] + 1, y = st_bbox(cpoly)[2] + 1,
  #     family = "EB Garamond", size = 6, hjust = 0,
  #     color = "white", fill = NA, label.size = 0
  #   ) +
  #   coord_sf(clip = "off") +
  #   theme_void(base_family = "EB Garamond") +
  #   theme(
  #     plot.background = element_rect(fill = col_bg, color = NA),
  #     panel.background = element_rect(fill = col_bg, color = NA)
  #   )
  # 
  # --- Plot 2: Roman roads still in use -----------------------------------
  p2 <- ggplot() +
    # base: all modern roads (muted blue)
    geom_sf(data = modern_ctry, color = "#8ecae6", linewidth = 0.2, alpha = 0.4) +
    # highlight: continuous Roman overlaps (bright orange)
    geom_sf(data = ancient_overlap, color = "#FB8500", linewidth = 0.3, alpha = 0.9) +
    labs(
      title = glue("{country_name}"),
      subtitle = glue(
        "<span style='font-family:Al Nile; font-weight:bold'>{round(pct_ancient,1)}%</span> of ancient Roman roads remain in use today <br>",
        "<span style='color:#8ecae6'>Modern roads</span> shown as base layer <br>",
        "<span style='color:#FB8500'>Ancient Roman roads</span> that overlap with modern infrastructure are highlighted <br>",
      ),
      caption = "Ancient roads: Itiner-e (Brughmans et al. 2024) | Modern roads: OpenStreetMap (Geofabrik via osmextract)\nInitial Visualization: Ansgar Wolsing \nUpdated Visualization: Aliaksandra Shymanskaya"
    ) +
    coord_sf(clip = "off") +
    theme_void(base_family = "Al Nile") +
    theme(
      plot.title.position = "plot",
      plot.subtitle.position = "plot",
      plot.background = element_rect(fill = col_bg, color = NA),
      panel.background = element_rect(fill = col_bg, color = NA),
      plot.title = element_text(
        family = "Al Nile",
        color = "#fefdf5", 
        size = 22, 
        hjust = 0,
        margin = margin(t = 10, l = 0, b = 2)
      ),
      plot.subtitle = element_markdown(
        family = "Al Nile",
        color = "#fefdf5",
        size = 10,
        hjust = 0,
        lineheight = 1.3,
        margin = margin(t = 2, b = 10, l = 0)
      ),
      plot.caption = element_text(
        family = "Al Nile",
        color = "#fefdf5",
        size = 7,
        hjust = 0.5,
        lineheight = 1.2,
        margin = margin(t = 10, b = 5)
      ),
      plot.margin = margin(10, 10, 10, 10)
    )
  
  
  
  # --- Save both maps -----------------------------------------------------
  out_dir <- here("plots")
  if (!dir.exists(out_dir)) dir.create(out_dir, recursive = TRUE)
  
  # ggsave(file.path(out_dir, paste0(country_name, "-modern-were-roman.png")),
  #        p1, width = 5, height = 8, dpi = 300, bg = col_bg)
  # Save with ragg device for better font rendering
  ggsave(
    file.path(out_dir, paste0(country_name, "-roman-still-in-use.svg")),
    p2, 
    width = 5, 
    height = 8, 
    dpi = 300, 
    bg = col_bg,
    device = ragg::agg_png
  )
  ggsave(
    file.path(out_dir, paste0(country_name, "-roman-still-in-use.png")),
    p2, 
    width = 5, 
    height = 8, 
    dpi = 300, 
    bg = col_bg,
    device = ragg::agg_png
  )
  
  # --- Return summary stats ----------------------------------------------
  tibble(
    country = country_name,
    pct_ancient_in_use = round(pct_ancient, 2),
    pct_modern_from_roman = round(pct_modern, 2),
    km_ancient_total = round(len_km(ancient_ctry), 1),
    km_modern_total = round(len_km(modern_ctry), 1)
  )
}


# --- 4. Run all countries -----------------------------------------------
results <- map_dfr(target_countries, process_country)

# --- 5. Print and save the table ----------------------------------------
cat("\n==============================\nRoman–Modern Road Overlaps\n==============================\n")
print(results)

write_csv(results, here("plots", "roman-modern-road-overlaps.csv"))

