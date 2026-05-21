# Moved to CORE_UX

Autocomplete components were moved out of CORE_JS (Semantic UI) into **CORE_UX** as DOM-native components.

| Removed (CORE_JS) | Replacement (CORE_UX) |
|-------------------|------------------------|
| `ui-autocomplete` | `<core-autocomplete>` |
| `ui-autocomplete-chips` | `<core-autocomplete-chips>` |
| `AutocompleteComponent` | `CoreAutocomplete` |
| `AutocompleteChipsComponent` | `CoreAutocompleteChips` |

```javascript
// Before
import { AutocompleteComponent } from 'CORE_JS/components/semantic-ui/autocomplete/autocomplete-component.js';

// After
import { CoreAutocomplete } from 'CORE_UX/components/core-autocomplete/core-autocomplete.js';
```

See `CORE_UX/components/core-autocomplete/README.md` for API and migration details.

**MyManager / other apps:** update imports and tag names; register components via your app `core-ux-*.js` entry or `CORE_UX/index.js`.
