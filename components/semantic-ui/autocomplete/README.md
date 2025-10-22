# Autocomplete Component

A generic autocomplete component built on top of Semantic UI (local data only) that provides customizable autocomplete functionality.

## Features

- **Flexible Data Sources**: Support for arrays, functions (Promise) and RxJS Observables
- **Debounced Search**: Configurable delay to control input handling
- **Customizable UI**: Built on Semantic UI with additional styling options
- **Event System**: Comprehensive event handling for all interactions
- **Accessibility**: Keyboard navigation and screen reader support
- **Loading States**: Built-in loading indicators
- **Error Handling**: Graceful error handling with fallbacks
- **Local Mode Only**: Semantic UI Search is forced to local mode (apiSettings disabled)

## Usage

### Basic HTML

```html
<ui-autocomplete 
    placeholder="Search users..." 
    min-characters="2" 
    delay="300">
</ui-autocomplete>
```

### With Array Data Source

```javascript
const autocomplete = document.querySelector('ui-autocomplete');

// Set array data source
const users = [
    { text: 'John Doe', value: 'john', description: 'Software Engineer' },
    { text: 'Jane Smith', value: 'jane', description: 'Product Manager' },
    { text: 'Bob Johnson', value: 'bob', description: 'Designer' }
];

autocomplete.setDataSource(users);
```

### With Function (Promise) Data Source

```javascript
const autocomplete = document.querySelector('ui-autocomplete');

// Set function data source
autocomplete.setDataSource(async (query) => {
    const response = await fetch(`/api/search?q=${query}`);
    return await response.json();
});
### With RxJS Observable Data Source

```javascript
import { of } from 'rxjs';
import { delay, map } from 'rxjs/operators';

const autocomplete = document.querySelector('ui-autocomplete');

autocomplete.setDataSource((query) => {
  return of([
    { title: 'Alice', value: 1 },
    { title: 'Bob', value: 2 }
  ]).pipe(
    delay(100),
    map(list => list.filter(i => i.title.toLowerCase().includes(query.toLowerCase())))
  );
});
```

```

### Event Handling

```javascript
const autocomplete = document.querySelector('ui-autocomplete');

// Listen for selection
autocomplete.addEventListener('autocomplete-select', (e) => {
    console.log('Selected:', e.detail.result);
});

// Listen for search
autocomplete.addEventListener('autocomplete-search', (e) => {
    console.log('Searching for:', e.detail.query);
});

// Listen for results
autocomplete.addEventListener('autocomplete-results', (e) => {
    console.log('Results:', e.detail.response);
});
```

## Attributes

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `placeholder` | string | 'Type to search...' | Placeholder text for input |
| `min-characters` | number | 3 | Minimum characters to trigger search |
| `delay` | number | 300 | Debounce delay in milliseconds |
| `max-results` | number | 10 | Maximum number of results to show |
| `allow-additions` | boolean | false | Allow adding new items |
| `force-selection` | boolean | false | Force selection from results |
| `clearable` | boolean | false | Show clear button |
| `placeholder-container` | string | - | i18n container key for placeholder |
| `placeholder-key` | string | - | i18n key for placeholder |
| `no-results-container` | string | - | i18n container key for no-results text |
| `no-results-key` | string | - | i18n key for no-results text |

## Methods

| Method | Parameters | Description |
|--------|------------|-------------|
| `setDataSource(source)` | `source` (Array\|Function) | Set data source for autocomplete |
| `preConfigure(options)` | `options` (Object) | Set defaults before initialization (wrappers) |
| `getValue()` | - | Get current input value |
| `setValue(value)` | `value` (string) | Set input value |
| `clear()` | - | Clear input and results |
| `focus()` | - | Focus the input |
| `blur()` | - | Blur the input |
| `enable()` | - | Enable the autocomplete |
| `disable()` | - | Disable the autocomplete |
| `configure(options)` | `options` (Object) | Update configuration at runtime |

## Events

| Event | Detail | Description |
|-------|--------|-------------|
| `autocomplete-select` | `{ result }` | Fired when an item is selected |
| `autocomplete-search` | `{ query }` | Fired when search is performed |
| `autocomplete-results` | `{ response }` | Fired when results are received |
| `autocomplete-open` | - | Fired when results dropdown opens |
| `autocomplete-close` | - | Fired when results dropdown closes |
| `autocomplete-focus` | - | Fired when input is focused |
| `autocomplete-blur` | - | Fired when input is blurred |

## Data Format

### Array Items

```javascript
const items = [
    // Simple string
    'Option 1',
    
    // Object with text
    { text: 'Option 2', value: 'opt2' },
    
    // Object with description
    { 
        text: 'Option 3', 
        value: 'opt3', 
        description: 'Additional info' 
    }
];
```

### Function Data Source

```javascript
const dataSource = async (query) => {
    // Return array of items
    const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
    const data = await response.json();
    
    return data.items.map(item => ({
        text: item.name,
        value: item.id,
        description: item.description
    }));
};
```

## Styling

The component includes additional CSS classes for customization:

- `.ui-autocomplete--small`: Smaller size
- `.ui-autocomplete--large`: Larger size
- `.ui-autocomplete--inverted`: Dark theme
- `.ui-autocomplete .ui.search.loading`: Loading state
- `.ui-autocomplete .ui.search.disabled`: Disabled state
- `.ui-autocomplete .ui.search.error`: Error state
- `.ui-autocomplete .ui.search.success`: Success state

## Examples

### User Search with API

```html
<ui-autocomplete 
    id="user-search"
    placeholder="Search users..."
    min-characters="2"
    delay="500"
    max-results="20">
</ui-autocomplete>

<script>
const userSearch = document.getElementById('user-search');

// Set up data source
userSearch.setDataSource(async (query) => {
    const response = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`);
    const data = await response.json();
    return data.users;
});

// Handle selection
userSearch.addEventListener('autocomplete-select', (e) => {
    const user = e.detail.result;
    console.log('Selected user:', user);
    // Handle user selection
});
</script>
```

### Local Data with Custom Format

```html
<ui-autocomplete 
    id="team-search"
    placeholder="Search teams..."
    min-characters="1">
</ui-autocomplete>

<script>
const teamSearch = document.getElementById('team-search');

// Set up local data
const teams = [
    { text: 'Development Team', value: 'dev', description: 'Software development' },
    { text: 'Design Team', value: 'design', description: 'UI/UX design' },
    { text: 'Marketing Team', value: 'marketing', description: 'Marketing and sales' }
];

teamSearch.setDataSource(teams);

// Handle selection
teamSearch.addEventListener('autocomplete-select', (e) => {
    const team = e.detail.result;
    console.log('Selected team:', team);
});
</script>
```
