# Load required libraries
library(sf)
library(ggplot2)
library(dplyr)

# Define ocean-inspired color palette
ocean_colors <- list(
  deep_blue = "#1a365d",
  ocean = "#2b6cb0",     
  light_blue = "#3182ce",
  coral = "#ed8936",
  warm = "#f6ad55",
  light_coral = "#fbd38d",
  neutral_900 = "#1a202c",
  neutral_800 = "#2d3748",
  neutral_700 = "#4a5568",
  neutral_600 = "#718096",
  neutral_500 = "#a0aec0",
  neutral_400 = "#cbd5e0",
  neutral_300 = "#e2e8f0",
  neutral_200 = "#edf2f7",
  neutral_100 = "#f7fafc",
  neutral_50 = "#fafbfc",
  white = "#ffffff"
)

# Enhanced Pacific region countries list (includes both full and abbreviated names)
pacific_countries <- c(
   "Papua New Guinea", "Fiji", "Vanuatu", 
  "Solomon Islands", "Solomon Is.", "New Caledonia", "Samoa", "Cook Islands", "Cook Is.",
  "Tuvalu", "Kiribati", "Nauru", "Marshall Islands", "Marshall Is.", "Palau", "Niue",
  "Federated States of Micronesia", "Micronesia", "French Polynesia", "Fr. Polynesia", 
  "Tokelau"
 
)

# Function to transform coordinates for date line crossing
transform_dateline_coords <- function(sf_data) {
  # Convert to a CRS that handles the Pacific better
  sf_data_transformed <- st_transform(sf_data, crs = "+proj=longlat +datum=WGS84")
  
  # Get coordinates and adjust for continuous mapping across date line
  coords <- st_coordinates(sf_data_transformed)
  
  # Convert western longitudes (negative) to 180+ system for continuous mapping
  # This puts everything in the 0-360 degree range
  coords[coords[,1] < 0, 1] <- coords[coords[,1] < 0, 1] + 360
  
  return(coords)
}

# Enhanced function to create Pacific map with proper date line handling
create_pacific_ocean_map_enhanced <- function(geojson_path, show_labels = FALSE, debug = FALSE) {
  # Read the GeoJSON file
  world_data <- st_read(geojson_path, quiet = TRUE)
  
  # Find country column
  country_column <- NULL
  possible_names <- c("name", "name_en", "admin", "NAME", "NAME_EN", "ADMIN",
                      "country", "Country", "COUNTRY", "sovereignt", "geounit")
  
  for (col in possible_names) {
    if (col %in% colnames(world_data)) {
      country_column <- col
      if (debug) cat("Using country column:", col, "\n")
      break
    }
  }
  
  if (is.null(country_column)) {
    stop("Could not find country name column. Available columns: ",
         paste(colnames(world_data), collapse = ", "))
  }
  
  if (debug) {
    # Print ALL available countries for debugging
    cat("\n=== ALL COUNTRIES IN DATASET ===\n")
    all_countries <- sort(unique(world_data[[country_column]]))
    print(all_countries)
    
    cat("\n=== LOOKING FOR THESE PACIFIC COUNTRIES ===\n")
    print(pacific_countries)
    
    # Check for any matches with Cook Islands or French Polynesia variants
    cook_matches <- all_countries[grepl("cook", all_countries, ignore.case = TRUE)]
    french_matches <- all_countries[grepl("french|polynesia|tahiti", all_countries, ignore.case = TRUE)]
    
    cat("\n=== COOK ISLANDS MATCHES ===\n")
    print(cook_matches)
    cat("\n=== FRENCH POLYNESIA MATCHES ===\n")
    print(french_matches)
  }
  
  # Now with updated pacific_countries list, exact matching should work better
  pacific_data <- world_data %>%
    filter(!!sym(country_column) %in% pacific_countries)
  
  if (debug) cat("Exact matches found:", nrow(pacific_data), "\n")
  
  # Still do partial matching as backup for any edge cases
  missing_islands <- c("Cook", "French Polynesia", "Polynesia", "Tahiti", "Fr\\.", "Is\\.")
  partial_matches <- world_data %>%
    filter(grepl(paste(missing_islands, collapse = "|"), !!sym(country_column), ignore.case = TRUE)) %>%
    filter(!(.[[country_column]] %in% pacific_data[[country_column]]))  # Avoid duplicates
  
  if (debug) cat("Additional partial matches found:", nrow(partial_matches), "\n")
  
  # Combine exact and partial matches
  pacific_data <- bind_rows(pacific_data, partial_matches) %>%
    distinct()
  
  # Geographic filtering as final backup (only if we have very few matches)
  if (nrow(pacific_data) < 10) {
    if (debug) cat("Adding geographic filtering as backup...\n")
    
    pacific_bounds <- world_data %>%
      rowwise() %>%
      mutate(
        bbox = list(st_bbox(geometry)),
        lon_min = bbox[[1]],
        lon_max = bbox[[3]], 
        lat_min = bbox[[2]],
        lat_max = bbox[[4]],
        # Handle date line crossing: convert western longitudes
        lon_min_adj = ifelse(lon_min < 0, lon_min + 360, lon_min),
        lon_max_adj = ifelse(lon_max < 0, lon_max + 360, lon_max),
        # Check if feature is in Pacific region
        is_pacific = (
          # Eastern Pacific (western longitudes converted to 180-360)
          (lon_min_adj >= 180 & lon_min_adj <= 260) |
            # Western Pacific  
            (lon_max >= 110 & lon_max <= 180) |
            # Features that cross date line
            (lon_min < -100 & lon_max > 100)
        ) & 
          # Latitude bounds for Pacific
          (lat_max >= -50 & lat_min <= 30)
      ) %>%
      ungroup() %>%
      filter(is_pacific) %>%
      filter(!(.[[country_column]] %in% pacific_data[[country_column]])) %>%  # Avoid duplicates
      select(-bbox, -lon_min, -lon_max, -lat_min, -lat_max, -lon_min_adj, -lon_max_adj, -is_pacific)
    
    if (debug) cat("Geographic filtering found:", nrow(pacific_bounds), "additional features\n")
    
    # Combine all approaches
    pacific_data <- bind_rows(pacific_bounds, pacific_data) %>%
      distinct()
  }
  
  if (debug) {
    cat("\n=== FINAL SELECTED COUNTRIES ===\n")
    final_countries <- sort(unique(pacific_data[[country_column]]))
    print(final_countries)
    
    # Check specifically for Cook Islands and French Polynesia
    cook_final <- final_countries[grepl("cook", final_countries, ignore.case = TRUE)]
    french_final <- final_countries[grepl("french|polynesia|tahiti|fr\\.", final_countries, ignore.case = TRUE)]
    
    cat("\n=== COOK ISLANDS IN FINAL SET ===\n")
    print(cook_final)
    cat("\n=== FRENCH POLYNESIA IN FINAL SET ===\n") 
    print(french_final)
  }
  
  if (!debug) cat("Total Pacific features found:", nrow(pacific_data), "\n")
  
  # Transform data to handle date line crossing
  # Create a custom transformation for Pacific-centered view
  pacific_data_transformed <- pacific_data %>%
    st_transform(crs = "+proj=longlat +datum=WGS84")
  
  # Calculate comprehensive bounds that include date line crossing
  # This covers from 110°E to 250°E (which is -110°W)
  pacific_bbox <- list(
    xmin = 110,   # Eastern Australia/Japan
    xmax = 230,   # Eastern Pacific (-110°W)
    ymin = -30,   # Southern extent
    ymax = 15     # Northern extent
  )
  
  # Create base map
  p <- ggplot() +
    # Ocean background
    geom_rect(aes(xmin = pacific_bbox$xmin, xmax = pacific_bbox$xmax,
                  ymin = pacific_bbox$ymin, ymax = pacific_bbox$ymax),
              fill = ocean_colors$ocean, alpha = 0.8) +
    
    # Country polygons with special handling for date line
    geom_sf(data = pacific_data_transformed,
            fill = ocean_colors$neutral_100,
            color = ocean_colors$white,
            size = 0.3,
            alpha = 0.9) +
    
    # Custom x-axis labels to show proper longitude values
    scale_x_continuous(
      breaks = seq(120, 240, by = 20),
      labels = function(x) {
        case_when(
          x <= 180 ~ paste0(x, "°E"),
          x > 180 ~ paste0(360 - x, "°W")
        )
      },
      expand = c(0, 0)
    ) +
    
    scale_y_continuous(
      breaks = seq(-40, 20, by = 20),
      labels = function(y) {
        ifelse(y >= 0, paste0(y, "°N"), paste0(abs(y), "°S"))
      },
      expand = c(0, 0)
    ) +
    
    # Coordinate system and limits
    coord_sf(xlim = c(pacific_bbox$xmin, pacific_bbox$xmax),
             ylim = c(pacific_bbox$ymin, pacific_bbox$ymax),
             expand = FALSE) +
    
    # Clean theme
    theme_void() +
    theme(
      plot.background = element_rect(fill = "transparent", color = NA),
      panel.background = element_rect(fill = "transparent", color = NA),
      panel.grid = element_blank(),
      axis.text = element_blank(),
      axis.title = element_blank(),
      axis.ticks = element_blank(),
      plot.title = element_blank(),
      plot.subtitle = element_blank(),
      plot.caption = element_blank(),
      legend.position = "none",
      plot.margin = margin(0, 0, 0, 0)    ) +
    
    # Labels
    labs(
      title = "Pacific Ocean Region - Complete Date Line Coverage",
      subtitle = "From Eastern Australia to Eastern Pacific (110°E to 110°W)",
      caption = "International Date Line crosses through the center of this map",
      x = "Longitude", 
      y = "Latitude"
    )
  
  # Add labels if requested
  if (show_labels) {
    # Calculate centroids for labels
    pacific_centroids <- pacific_data_transformed %>%
      st_centroid() %>%
      st_coordinates() %>%
      as.data.frame() %>%
      bind_cols(pacific_data_transformed %>% st_drop_geometry() %>% select(all_of(country_column)))
    
    # Adjust centroid coordinates for date line
    pacific_centroids <- pacific_centroids %>%
      mutate(X_adjusted = ifelse(X < 0, X + 360, X)) %>%
      filter(X_adjusted >= pacific_bbox$xmin & X_adjusted <= pacific_bbox$xmax,
             Y >= pacific_bbox$ymin & Y <= pacific_bbox$ymax)
    
    p <- p + 
      geom_text(data = pacific_centroids,
                aes(x = X_adjusted, y = Y-2, label = !!sym(country_column)),
                color = ocean_colors$neutral_400,
                size = 4,
                fontface = "bold",
                check_overlap = TRUE)
  }
  
  return(p)
}

# Enhanced ocean acidity mapping function
create_ocean_acidity_map_enhanced <- function(geojson_path, acidity_csv_path) {
  library(readr)
  library(viridis)
  library(scales)
  
  # Read data
  world_data <- st_read(geojson_path, quiet = TRUE)
  acidity_data <- read_csv(acidity_csv_path, show_col_types = FALSE)
  
  # Clean acidity data
  acidity_data <- acidity_data %>%
    filter(!is.na(ph_trend))
  
  cat("Loaded", nrow(acidity_data), "acidity data points\n")
  
  # Handle International Date Line crossing for acidity data
  acidity_data <- acidity_data %>%
    mutate(longitude_adjusted = ifelse(longitude < 0, longitude + 360, longitude))
  
  cat("Longitude range after adjustment:",
      min(acidity_data$longitude_adjusted), "to",
      max(acidity_data$longitude_adjusted), "\n")
  
  # Find country column
  country_column <- "name"  # Based on your example
  for (col in c("name", "name_en", "admin", "NAME", "NAME_EN", "ADMIN")) {
    if (col %in% colnames(world_data)) {
      country_column <- col
      break
    }
  }
  
  # Filter for Pacific countries
  pacific_data <- world_data %>%
    filter(!!sym(country_column) %in% pacific_countries)
  
  if (nrow(pacific_data) == 0) {
    pacific_data <- world_data
  }
  
  # Set comprehensive map bounds
  comprehensive_bbox <- list(
    xmin = min(c(110, min(acidity_data$longitude_adjusted) - 5)),
    xmax = max(c(230, max(acidity_data$longitude_adjusted) + 5)),
    ymin = min(c(-25, min(acidity_data$latitude) - 5)),
    ymax = max(c(15, max(acidity_data$latitude) + 5))
  )
  
  # Create the enhanced acidity map
  p <- ggplot() +
    # Ocean background
    geom_rect(aes(xmin = comprehensive_bbox$xmin, xmax = comprehensive_bbox$xmax,
                  ymin = comprehensive_bbox$ymin, ymax = comprehensive_bbox$ymax),
              fill = ocean_colors$white, alpha = 0.3) +
    
    # Acidity data points
    geom_point(data = acidity_data,
               aes(x = longitude_adjusted, y = latitude, color = ph_trend),
               size = 1.2, alpha = 0.8) +
    
    # Enhanced color scale for pH trend
    scale_color_gradient2(
      name = "pH Trend\n(per decade)",
      low = "#d73027",      # Red for more acidic
      mid = "#fee08b",      # Yellow for neutral
      high = "#1a9850",     # Green for less acidic
      midpoint = median(acidity_data$ph_trend, na.rm = TRUE),
      labels = function(x) format(x, scientific = TRUE, digits = 2),
      guide = guide_colorbar(
        title.position = "top",
        title.hjust = 0.5,
        barwidth = 15,
        barheight = 1
      )
    ) +
    
    # Country polygons
    geom_sf(data = pacific_data,
            fill = ocean_colors$neutral_100,
            color = ocean_colors$white,
            size = 0.4,
            alpha = 0.7) +
    
    # Enhanced axis labels
    scale_x_continuous(
      breaks = seq(120, 240, by = 20),
      labels = function(x) {
        case_when(
          x <= 180 ~ paste0(x, "°E"),
          x > 180 ~ paste0(360 - x, "°W")
        )
      }
    ) +
    
    scale_y_continuous(
      breaks = seq(-40, 20, by = 20),
      labels = function(y) {
        ifelse(y >= 0, paste0(y, "°N"), paste0(abs(y), "°S"))
      }
    ) +
    
    # Coordinate system
    coord_sf(xlim = c(comprehensive_bbox$xmin, comprehensive_bbox$xmax),
             ylim = c(comprehensive_bbox$ymin, comprehensive_bbox$ymax),
             expand = FALSE) +
    
    # Enhanced theme
    theme_void() +
    theme(
      plot.background = element_rect(fill = ocean_colors$neutral_900, color = NA),
      panel.background = element_rect(fill = ocean_colors$neutral_900, color = NA),
      plot.title = element_text(hjust = 0.5, size = 18, face = "bold",
                                color = ocean_colors$white, margin = margin(b = 10)),
      plot.subtitle = element_text(hjust = 0.5, size = 12,
                                   color = ocean_colors$neutral_200, margin = margin(b = 15)),
      plot.caption = element_text(hjust = 0.5, size = 10,
                                  color = ocean_colors$neutral_400, margin = margin(t = 15)),
      legend.position = "bottom",
      legend.title = element_text(color = ocean_colors$white, size = 11),
      legend.text = element_text(color = ocean_colors$white, size = 9),
      plot.margin = margin(20, 20, 20, 20),
      axis.text.x = element_text(color = ocean_colors$white, size = 9),
      axis.text.y = element_text(color = ocean_colors$white, size = 9),
      axis.title.x = element_text(color = ocean_colors$white, size = 10),
      axis.title.y = element_text(color = ocean_colors$white, size = 10)
    ) +
    
    # Labels
    labs(
      title = "Ocean Acidification Trends - Complete Pacific Coverage",
      subtitle = "pH Trend per Decade (Full International Date Line Coverage)",
      caption = paste("Data points:", nrow(acidity_data), "| More red = More acidic trends"),
      x = "Longitude", 
      y = "Latitude"
    )
  
  return(p)
}

# Simple wrapper functions
create_pacific_map <- function(geojson_path, with_labels = FALSE, debug = FALSE) {
  return(create_pacific_ocean_map_enhanced(geojson_path, show_labels = with_labels, debug = debug))
}

create_acidity_map <- function(geojson_path, acidity_csv_path) {
  return(create_ocean_acidity_map_enhanced(geojson_path, acidity_csv_path))
}

# Function to create and save both maps
create_complete_pacific_maps <- function(geojson_path, acidity_csv_path = NULL) {
  # Create basic geographic map
  cat("Creating Pacific geographic map...\n")
  geo_map <- create_pacific_map(geojson_path, with_labels = TRUE)
  
  # Save basic map
  ggsave("pacific_ocean_complete_map.png", geo_map, width = 16, height = 10, dpi = 300)
  cat("Saved enhanced map as: pacific_ocean_complete_map.png\n")
  
  # Create acidity map if CSV is provided
  if (!is.null(acidity_csv_path) && file.exists(acidity_csv_path)) {
    cat("Creating ocean acidity map...\n")
    acidity_map <- create_acidity_map(geojson_path, acidity_csv_path)
    
    # Save acidity map
    ggsave("pacific_ocean_acidity_complete_map.png", acidity_map, width = 16, height = 10, dpi = 300)
    cat("Saved enhanced acidity map as: pacific_ocean_acidity_complete_map.png\n")
    
    return(list(geographic = geo_map, acidity = acidity_map))
  } else {
    cat("Acidity CSV not found or not provided. Only geographic map created.\n")
    return(list(geographic = geo_map))
  }
}

# Example usage with debugging:
# geo_map <- create_pacific_map("../data/custom.geo.json", with_labels = TRUE, debug = TRUE)
# print(geo_map)
# 
# # Once you know what countries are available, you can turn off debugging:
geo_map <- create_pacific_map("../data/custom.geo.json", with_labels = TRUE, debug = FALSE)
ggsave("pacific_ocean_complete_map_no_au.png", geo_map, width = 16, height = 10, dpi = 300)
ggsave("pacific_ocean_complete_map_no_au.svg", geo_map, width = 16, height = 10, dpi = 300)

acidity_map <- create_acidity_map("../data/custom.geo.json", "../data/total_average_acidity.csv")
ggsave("pacific_ocean_acidity.png", acidity_map, width = 16, height = 10, dpi = 300)
ggsave("pacific_ocean_acidity.svg", acidity_map, width = 16, height = 10, dpi = 300)
