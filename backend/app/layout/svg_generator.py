import datetime
from typing import Dict, List, Set, Tuple
from app.data.models import SolverResult, GameData, BeltConnection, ProductionStep

class BlueprintGenerator:
    """Generates an SVG schematic blueprint from a SolverResult."""

    def __init__(self, game_data: GameData):
        self.game_data = game_data

        # SVG Design Specifications
        self.bg_color = "#1A2332"
        self.grid_color = "#1E2D3D"
        self.padding = 60
        self.col_spacing = 280
        self.row_spacing = 180
        self.node_width = 220
        self.node_height = 120
        self.path_color = "#4A90D9"

    def _get_chain_color(self, item_id: str) -> str:
        """Get the border color based on the material chain."""
        if "iron" in item_id.lower():
            return "#C8A87C"
        elif "copper" in item_id.lower() or "wire" in item_id.lower() or "cable" in item_id.lower():
            return "#E87C3C"
        elif "steel" in item_id.lower() or "pipe" in item_id.lower() or "beam" in item_id.lower():
            return "#6B7B8D"
        else:
            return "#4A90D9"

    def _topological_sort(self, result: SolverResult) -> Dict[str, int]:
        """Assign each step a column index based on depth from raw resources."""
        # This is a simple longest-path implementation for column assignment.
        col_assignment: Dict[str, int] = {}
        
        # Initialize depths
        for step in result.steps:
            col_assignment[step.step_id] = 0
            
        # Add 'input' and 'output' pseudo-nodes for connection sorting
        col_assignment["input"] = -1
        col_assignment["output"] = len(result.steps) + 1 # will adjust later

        changed = True
        while changed:
            changed = False
            for conn in result.connections:
                if conn.from_step_id == "input" or conn.to_step_id == "output":
                    continue
                # If source is deeper or equal to destination, push destination right
                if col_assignment.get(conn.from_step_id, 0) >= col_assignment.get(conn.to_step_id, 0):
                    col_assignment[conn.to_step_id] = col_assignment[conn.from_step_id] + 1
                    changed = True

        # Shift everything so input is at 0, steps start at 1
        min_col = min([c for k, c in col_assignment.items() if k != "input" and k != "output"], default=0)
        for k in col_assignment:
            if k == "input":
                col_assignment[k] = 0
            elif k == "output":
                pass # Set later based on max step col
            else:
                col_assignment[k] = col_assignment[k] - min_col + 1
                
        max_col = max([c for k, c in col_assignment.items() if k != "output"], default=0)
        col_assignment["output"] = max_col + 1
        
        return col_assignment

    def generate(self, result: SolverResult) -> str:
        """Returns complete SVG markup as a string."""
        cols = self._topological_sort(result)
        
        # Group nodes by column to assign row positions
        col_groups: Dict[int, List[str]] = {}
        for node_id, col in cols.items():
            if col not in col_groups:
                col_groups[col] = []
            col_groups[col].append(node_id)
            
        # Assign coordinates
        positions: Dict[str, Tuple[float, float]] = {}
        max_rows = max(len(nodes) for nodes in col_groups.values()) if col_groups else 0
        
        for col, nodes in col_groups.items():
            x = self.padding + col * self.col_spacing
            
            # Center the nodes vertically
            y_offset = self.padding + (max_rows - len(nodes)) * self.row_spacing / 2
            
            for row, node_id in enumerate(nodes):
                y = y_offset + row * self.row_spacing
                positions[node_id] = (x, y)

        # Calculate canvas size
        max_x = max([p[0] for p in positions.values()], default=0) + self.node_width + self.padding
        max_y = max([p[1] for p in positions.values()], default=0) + self.node_height + self.padding
        
        width = max(max_x, 800)
        height = max(max_y, 600)

        svg = []
        svg.append(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" width="{width}" height="{height}">')
        
        # Background
        svg.append(f'<rect width="{width}" height="{height}" fill="{self.bg_color}" />')
        
        # Grid
        svg.append(f'''
        <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="{self.grid_color}" stroke-width="1"/>
            </pattern>
        </defs>
        <rect width="{width}" height="{height}" fill="url(#grid)" />
        ''')

        # Title Block
        title_y = self.padding
        svg.append(f'''
        <g transform="translate({self.padding}, {self.padding/2})">
            <text x="0" y="0" fill="white" font-family="sans-serif" font-size="24" font-weight="bold">FACTORY BLUEPRINT</text>
            <text x="0" y="20" fill="#A0AEC0" font-family="sans-serif" font-size="14">Power: {result.total_power:.1f} MW | Machines: {result.total_machines}</text>
            <text x="0" y="40" fill="#A0AEC0" font-family="sans-serif" font-size="12">Generated: {datetime.datetime.now().strftime("%Y-%m-%d %H:%M")}</text>
        </g>
        ''')

        # Draw Connections
        for conn in result.connections:
            if conn.from_step_id not in positions or conn.to_step_id not in positions:
                continue
                
            from_pos = positions[conn.from_step_id]
            to_pos = positions[conn.to_step_id]
            
            # Source right edge
            if conn.from_step_id == "input":
                x1 = from_pos[0] + 25
                y1 = from_pos[1] + 25
            else:
                x1 = from_pos[0] + self.node_width
                y1 = from_pos[1] + self.node_height / 2
                
            # Dest left edge
            if conn.to_step_id == "output":
                x2 = to_pos[0]
                y2 = to_pos[1] + 30
            else:
                x2 = to_pos[0]
                y2 = to_pos[1] + self.node_height / 2
                
            # Cubic bezier
            ctrl_x1 = x1 + (x2 - x1) / 2
            ctrl_x2 = x2 - (x2 - x1) / 2
            
            belt_width = 1.5 + (conn.belt_tier - 1) * 0.5
            
            svg.append(f'<path d="M {x1} {y1} C {ctrl_x1} {y1}, {ctrl_x2} {y2}, {x2} {y2}" fill="none" stroke="{self.path_color}" stroke-width="{belt_width}" />')
            
            # Label
            mid_x = (x1 + x2) / 2
            mid_y = (y1 + y2) / 2
            
            item_name = self.game_data.items[conn.item_id].display_name if conn.item_id in self.game_data.items else conn.item_id
            
            svg.append(f'''
            <g transform="translate({mid_x}, {mid_y})">
                <rect x="-40" y="-15" width="80" height="30" fill="{self.bg_color}" rx="4" />
                <text x="0" y="-3" fill="white" font-family="sans-serif" font-size="10" text-anchor="middle">{item_name}</text>
                <text x="0" y="9" fill="#90CDF4" font-family="sans-serif" font-size="10" text-anchor="middle">{conn.rate:.1f}/min (Mk.{conn.belt_tier})</text>
            </g>
            ''')

        # Draw Nodes
        for node_id, (x, y) in positions.items():
            if node_id == "input":
                # Resources input node
                for i, (res_id, rate) in enumerate(result.resource_usage.items()):
                    res_name = self.game_data.items[res_id].display_name if res_id in self.game_data.items else res_id
                    res_color = self._get_chain_color(res_id)
                    y_offset = y + i * 80
                    svg.append(f'''
                    <g transform="translate({x}, {y_offset})">
                        <circle cx="25" cy="25" r="25" fill="{res_color}" />
                        <text x="25" y="65" fill="white" font-family="sans-serif" font-size="12" text-anchor="middle">{res_name}</text>
                        <text x="25" y="80" fill="#A0AEC0" font-family="sans-serif" font-size="10" text-anchor="middle">{rate:.1f}/min</text>
                    </g>
                    ''')
            elif node_id == "output":
                # Products output node
                for i, (prod_id, rate) in enumerate(result.target_outputs.items()):
                    prod_name = self.game_data.items[prod_id].display_name if prod_id in self.game_data.items else prod_id
                    y_offset = y + i * 80
                    svg.append(f'''
                    <g transform="translate({x}, {y_offset})">
                        <polygon points="30,0 60,15 60,45 30,60 0,45 0,15" fill="#2ECC71" />
                        <text x="30" y="75" fill="white" font-family="sans-serif" font-size="12" text-anchor="middle">{prod_name}</text>
                        <text x="30" y="90" fill="#A0AEC0" font-family="sans-serif" font-size="10" text-anchor="middle">{rate:.1f}/min</text>
                    </g>
                    ''')
            else:
                # Machine node
                step = result.get_step(node_id)
                if not step: continue
                
                # Use main output item to determine color
                main_out = list(step.output_rates.keys())[0] if step.output_rates else step.recipe_id
                border_color = self._get_chain_color(main_out)
                
                svg.append(f'''
                <g transform="translate({x}, {y})">
                    <rect width="{self.node_width}" height="{self.node_height}" fill="#2D3748" stroke="{border_color}" stroke-width="2" rx="12" />
                    
                    <circle cx="25" cy="25" r="12" fill="{border_color}" />
                    <text x="45" y="30" fill="white" font-family="sans-serif" font-size="14" font-weight="bold">{step.recipe.display_name}</text>
                    
                    <text x="15" y="60" fill="#CBD5E0" font-family="sans-serif" font-size="12">{step.machine_count}× {step.building.display_name}</text>
                    
                    <text x="15" y="85" fill="#90CDF4" font-family="sans-serif" font-size="13" font-weight="bold">Out: {sum(step.output_rates.values()):.1f}/min</text>
                    ''')
                
                if step.clock_speed < 100.0:
                    svg.append(f'<text x="15" y="105" fill="#F6E05E" font-family="sans-serif" font-size="11">⏱ {step.clock_speed:.1f}%</text>')
                else:
                    svg.append(f'<text x="15" y="105" fill="#A0AEC0" font-family="sans-serif" font-size="11">⏱ 100%</text>')
                    
                svg.append('</g>')

        # Shopping List Panel
        shop_x = width - 250
        shop_y = self.padding
        svg.append(f'''
        <g transform="translate({shop_x}, {shop_y})">
            <rect width="200" height="{40 + len(result.shopping_list)*20}" fill="#2D3748" rx="8" />
            <text x="100" y="25" fill="white" font-family="sans-serif" font-size="14" font-weight="bold" text-anchor="middle">Shopping List</text>
        ''')
        for i, (item_id, count) in enumerate(result.shopping_list.items()):
            name = self.game_data.buildings[item_id].display_name if item_id in self.game_data.buildings else item_id
            svg.append(f'<text x="15" y="{50 + i*20}" fill="#CBD5E0" font-family="sans-serif" font-size="12">{name}: {count}</text>')
        svg.append('</g>')

        svg.append('</svg>')
        
        return "\n".join(svg)
