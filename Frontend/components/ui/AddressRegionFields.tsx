"use client";

import { useMemo } from "react";
import { CountryAutocompleteInput } from "./CountryAutocompleteInput";
import { ListAutocompleteInput } from "./ListAutocompleteInput";
import { countryHasRegionHierarchy, getDistrictsForState, getStatesForCountry } from "@/lib/geo-regions";

export function AddressRegionFields({
  countryName,
  stateName,
  districtName,
  country,
  stateProvince,
  district,
  onCountryChange,
  onStateChange,
  onDistrictChange,
  inputClass,
  labelClass,
}: {
  countryName: string;
  stateName: string;
  districtName: string;
  country: string;
  stateProvince: string;
  district: string;
  onCountryChange: (next: string) => void;
  onStateChange: (next: string) => void;
  onDistrictChange: (next: string) => void;
  inputClass: string;
  labelClass: string;
}) {
  const stateOptions = useMemo(() => getStatesForCountry(country), [country]);
  const districtOptions = useMemo(() => getDistrictsForState(country, stateProvince), [country, stateProvince]);
  const hasHierarchy = countryHasRegionHierarchy(country);
  const hasStateList = stateOptions.length > 0;

  function handleCountryChange(next: string) {
    onCountryChange(next);
    onStateChange("");
    onDistrictChange("");
  }

  function handleStateChange(next: string) {
    onStateChange(next);
    onDistrictChange("");
  }

  return (
    <>
      <div>
        <label className={labelClass}>Country</label>
        <CountryAutocompleteInput
          name={countryName}
          value={country}
          onChange={handleCountryChange}
          className={inputClass}
          placeholder="Type to search country…"
        />
      </div>
      <div>
        <label className={labelClass}>State/Province</label>
        <ListAutocompleteInput
          name={stateName}
          value={stateProvince}
          onChange={handleStateChange}
          options={stateOptions}
          className={inputClass}
          placeholder={
            !country.trim()
              ? "Select country first"
              : hasStateList
                ? "Type to search state/province…"
                : "Enter state/province"
          }
          disabled={!country.trim()}
        />
      </div>
      <div>
        <label className={labelClass}>District</label>
        <ListAutocompleteInput
          name={districtName}
          value={district}
          onChange={onDistrictChange}
          options={districtOptions}
          className={inputClass}
          placeholder={
            !country.trim()
              ? "Select country first"
              : hasHierarchy && !stateProvince.trim()
                ? "Select state/province first"
                : districtOptions.length
                  ? "Type to search district…"
                  : "Enter district"
          }
          disabled={!country.trim() || (hasHierarchy && !stateProvince.trim())}
        />
      </div>
    </>
  );
}
