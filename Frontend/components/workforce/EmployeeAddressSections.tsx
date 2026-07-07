"use client";

import {
  AddressRegionFields,
  AddressTextInput,
  DistanceKmInput,
  FormSelect,
  PostalCodeInput,
  type FormSelectOption,
} from "@/components/ui";
import { distanceKmInputValue } from "@/lib/employee-address";

function SectionIcon({ path, color }: { path: string; color: string }) {
  return (
    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${color}`}>
      <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d={path} />
      </svg>
    </div>
  );
}

export type EmployeeAddressSectionsProps = {
  values: {
    addressStreet1?: string | null;
    addressStreet2?: string | null;
    city?: string | null;
    zipPostalCode?: string | null;
    pollingDivision?: string | null;
    distanceToOffice?: string | null;
    modeOfTransport?: string | null;
    permanentStreet1?: string | null;
    permanentStreet2?: string | null;
    permanentCity?: string | null;
    permanentZipPostalCode?: string | null;
    permanentPollingDivision?: string | null;
    permanentDistanceToOffice?: string | null;
  };
  addrCountry: string;
  addrState: string;
  addrDistrict: string;
  permCountry: string;
  permState: string;
  permDistrict: string;
  onAddrCountryChange: (value: string) => void;
  onAddrStateChange: (value: string) => void;
  onAddrDistrictChange: (value: string) => void;
  onPermCountryChange: (value: string) => void;
  onPermStateChange: (value: string) => void;
  onPermDistrictChange: (value: string) => void;
  inputClass: string;
  labelClass: string;
  sectionCardHeaderRow: string;
  forceShowError?: boolean;
  modeOfTransportOptions?: FormSelectOption[];
  showModeOfTransport?: boolean;
};

export function EmployeeAddressSections({
  values,
  addrCountry,
  addrState,
  addrDistrict,
  permCountry,
  permState,
  permDistrict,
  onAddrCountryChange,
  onAddrStateChange,
  onAddrDistrictChange,
  onPermCountryChange,
  onPermStateChange,
  onPermDistrictChange,
  inputClass,
  labelClass,
  sectionCardHeaderRow,
  forceShowError = false,
  modeOfTransportOptions = [],
  showModeOfTransport = true,
}: EmployeeAddressSectionsProps) {
  return (
    <>
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className={sectionCardHeaderRow}>
          <div className="flex items-center gap-2.5">
            <SectionIcon
              path="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
              color="bg-blue-500"
            />
            <h2 className="text-[15px] font-bold text-slate-700">Current Address</h2>
          </div>
        </div>
        <div className="p-6">
          <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className={labelClass}>Address Street 1</label>
              <AddressTextInput
                name="addressStreet1"
                autoComplete="address-line1"
                className={inputClass}
                defaultValue={values.addressStreet1 ?? ""}
                forceShowError={forceShowError}
              />
            </div>
            <div>
              <label className={labelClass}>Address Street 2</label>
              <AddressTextInput
                name="addressStreet2"
                autoComplete="address-line2"
                className={inputClass}
                defaultValue={values.addressStreet2 ?? ""}
                forceShowError={forceShowError}
              />
            </div>
            <div>
              <label className={labelClass}>City</label>
              <AddressTextInput
                name="city"
                autoComplete="address-level2"
                className={inputClass}
                defaultValue={values.city ?? ""}
                forceShowError={forceShowError}
              />
            </div>
            <AddressRegionFields
              countryName="country"
              stateName="stateProvince"
              districtName="district"
              country={addrCountry}
              stateProvince={addrState}
              district={addrDistrict}
              onCountryChange={onAddrCountryChange}
              onStateChange={onAddrStateChange}
              onDistrictChange={onAddrDistrictChange}
              inputClass={inputClass}
              labelClass={labelClass}
            />
            <div>
              <label className={labelClass}>Zip/Postal Code</label>
              <PostalCodeInput
                name="zipPostalCode"
                autoComplete="postal-code"
                className={inputClass}
                defaultValue={values.zipPostalCode ?? ""}
                forceShowError={forceShowError}
              />
            </div>
            <div>
              <label className={labelClass}>Polling Division</label>
              <AddressTextInput
                name="pollingDivision"
                className={inputClass}
                defaultValue={values.pollingDivision ?? ""}
                forceShowError={forceShowError}
              />
            </div>
            <div>
              <label className={labelClass}>Distance to Office(KM)</label>
              <DistanceKmInput
                name="distanceToOffice"
                className={inputClass}
                defaultValue={distanceKmInputValue(values.distanceToOffice)}
                forceShowError={forceShowError}
              />
            </div>
            {showModeOfTransport ? (
              <div>
                <label className={labelClass}>Mode of Transport</label>
                <FormSelect
                  name="modeOfTransport"
                  defaultValue={values.modeOfTransport ?? ""}
                  options={modeOfTransportOptions}
                  placeholder="-- Select --"
                />
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className={sectionCardHeaderRow}>
          <div className="flex items-center gap-2.5">
            <SectionIcon
              path="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1m-2 0h2"
              color="bg-amber-500"
            />
            <h2 className="text-[15px] font-bold text-slate-700">Permanent Address</h2>
          </div>
        </div>
        <div className="p-6">
          <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className={labelClass}>Address Street 1</label>
              <AddressTextInput
                name="permanentStreet1"
                autoComplete="address-line1"
                className={inputClass}
                defaultValue={values.permanentStreet1 ?? ""}
                forceShowError={forceShowError}
              />
            </div>
            <div>
              <label className={labelClass}>Address Street 2</label>
              <AddressTextInput
                name="permanentStreet2"
                autoComplete="address-line2"
                className={inputClass}
                defaultValue={values.permanentStreet2 ?? ""}
                forceShowError={forceShowError}
              />
            </div>
            <div>
              <label className={labelClass}>City</label>
              <AddressTextInput
                name="permanentCity"
                autoComplete="address-level2"
                className={inputClass}
                defaultValue={values.permanentCity ?? ""}
                forceShowError={forceShowError}
              />
            </div>
            <AddressRegionFields
              countryName="permanentCountry"
              stateName="permanentStateProvince"
              districtName="permanentDistrict"
              country={permCountry}
              stateProvince={permState}
              district={permDistrict}
              onCountryChange={onPermCountryChange}
              onStateChange={onPermStateChange}
              onDistrictChange={onPermDistrictChange}
              inputClass={inputClass}
              labelClass={labelClass}
            />
            <div>
              <label className={labelClass}>Zip/Postal Code</label>
              <PostalCodeInput
                name="permanentZipPostalCode"
                autoComplete="postal-code"
                className={inputClass}
                defaultValue={values.permanentZipPostalCode ?? ""}
                forceShowError={forceShowError}
              />
            </div>
            <div>
              <label className={labelClass}>Polling Division</label>
              <AddressTextInput
                name="permanentPollingDivision"
                className={inputClass}
                defaultValue={values.permanentPollingDivision ?? ""}
                forceShowError={forceShowError}
              />
            </div>
            <div>
              <label className={labelClass}>Distance to Office(KM)</label>
              <DistanceKmInput
                name="permanentDistanceToOffice"
                className={inputClass}
                defaultValue={distanceKmInputValue(values.permanentDistanceToOffice)}
                forceShowError={forceShowError}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
