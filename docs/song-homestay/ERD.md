# ERD và Data Dictionary

```mermaid
erDiagram
  PROPERTIES ||--o{ UNIT_TYPES : contains
  PROPERTIES ||--o{ UNITS : owns
  UNIT_TYPES ||--o{ UNITS : classifies
  UNIT_TYPES ||--o{ RATE_PLANS : prices
  PROPERTIES ||--o{ GUESTS : serves
  PROPERTIES ||--o{ BOOKINGS : centralizes
  UNITS ||--o{ BOOKINGS : assigned
  GUESTS ||--o{ BOOKINGS : makes
  BOOKINGS ||--o{ UNIT_NIGHTS : blocks
  PROPERTIES ||--o{ ADD_ONS : offers
  BOOKINGS ||--o{ BOOKING_ADD_ONS : includes
  ADD_ONS ||--o{ BOOKING_ADD_ONS : snapshots
  BOOKINGS ||--o{ RESIDENCE_REGISTRATIONS : has

  PROPERTIES {
    id propertyId PK
    string name
    string slug
    string timezone
    string currency
    boolean allowPayAtProperty
  }
  UNITS {
    id unitId PK
    id propertyId FK
    id unitTypeId FK
    string name
    string status
    array icalImports
  }
  BOOKINGS {
    id bookingId PK
    id propertyId FK
    id unitId FK
    id guestId FK
    date checkIn
    date checkOut
    string status
    string source
    string externalUid
    boolean syncConflict
  }
  UNIT_NIGHTS {
    id unitNightId PK
    id unitId FK
    id bookingId FK
    date date
    string kind
  }
  RESIDENCE_REGISTRATIONS {
    id registrationId PK
    id bookingId FK
    string documentType
    string documentNumber
    string status
  }
```

## Ràng buộc quan trọng

- Mỗi căn/ngày chỉ được cấp cho một booking thông qua kiểm tra `unitNights` trong transaction.
- `checkOut` là ngày loại trừ.
- `externalUid` kết hợp với căn và nhãn nguồn bảo đảm import idempotent.
- Booking iCal giữ đủ khoảng ngày ngay cả khi có xung đột; chỉ các đêm còn trống được tạo `unitNights`.
- Booking đã hủy không giữ `unitNights`.
- `bookingAddOns` lưu snapshot để thay đổi danh mục dịch vụ không sửa lịch sử.

